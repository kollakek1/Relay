import type { Prisma } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'
import { claimIdempotencyKey, releaseIdempotencyKey } from '@/shared/server/idempotency'
import { guardJobRequest, jobJson } from '@/shared/server/job-auth'
import { logger } from '@/shared/server/logger'
import { runSlaScan } from '@/features/sla/server/service'

export const dynamic = 'force-dynamic'

const JOB = 'sla-scan'

/**
 * POST /api/jobs/sla-scan
 *
 * Scheduled SLA scan. Idempotent per hour: repeated triggers within the same hour
 * are no-ops. Requires `Authorization: Bearer <CRON_SECRET>`; the secret is
 * never accepted from the query string. Only POST is exported, so other methods
 * receive Next.js' 405 response.
 */
export async function POST(request: Request): Promise<Response> {
  const rejected = guardJobRequest(request)
  if (rejected) return rejected

  const startedAt = new Date()
  const bucket = startedAt.toISOString().slice(0, 13) // YYYY-MM-DDTHH
  const key = `job:sla-scan:${bucket}`

  const claimed = await claimIdempotencyKey(key, 'job', 2 * 60 * 60 * 1000)
  if (!claimed) {
    return jobJson({ ok: true, skipped: true, reason: 'already ran this hour' }, 200)
  }

  try {
    const metrics = await runSlaScan(startedAt)
    await prisma.jobRun.create({
      data: {
        job: JOB,
        status: 'SUCCESS',
        finishedAt: new Date(),
        metrics: metrics as unknown as Prisma.InputJsonValue,
      },
    })
    return jobJson({ ok: true, metrics }, 200)
  } catch (error) {
    // A failed run must not occupy the hour bucket — let the scheduler retry.
    await releaseIdempotencyKey(key)
    const message = error instanceof Error ? error.message : String(error)
    await prisma.jobRun.create({
      data: { job: JOB, status: 'FAILED', finishedAt: new Date(), error: message },
    })
    logger.error('job_failed', { job: JOB, message })
    return jobJson({ ok: false, error: 'Job failed' }, 500)
  }
}
