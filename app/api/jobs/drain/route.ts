import { prisma } from '@/shared/lib/prisma'
import { guardJobRequest, jobJson } from '@/shared/server/job-auth'
import { logger, newRequestId } from '@/shared/server/logger'
import { pruneIdempotencyKeys, claimIdempotencyKey, releaseIdempotencyKey } from '@/shared/server/idempotency'
import { drainOutbox } from '@/features/webhooks/server/delivery'
import { runAutomationsForPendingEvents } from '@/features/automation/server/service'

export const dynamic = 'force-dynamic'

const JOB = 'outbox-drain'

/**
 * POST /api/jobs/drain
 *
 * Bounded, idempotent maintenance job: fans unprocessed outbox events out to
 * subscribed webhooks, retries automation rules, and attempts due deliveries.
 * Requires `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(request: Request): Promise<Response> {
  const rejected = guardJobRequest(request)
  if (rejected) return rejected

  const runId = newRequestId()
  const startedAt = new Date()
  const bucket = startedAt.toISOString().slice(0, 16) // per-minute bucket
  const key = `job:outbox-drain:${bucket}`

  const claimed = await claimIdempotencyKey(key, 'job', 5 * 60 * 1000)
  if (!claimed) {
    return jobJson({ ok: true, skipped: true, reason: 'already ran this minute' }, 200)
  }

  try {
    const result = await drainOutbox({ now: startedAt, runId })
    const pendingAutomations = await runAutomationsForPendingEvents({ runId })
    const prunedKeys = await pruneIdempotencyKeys()
    const metrics = { ...result, ...pendingAutomations, prunedKeys }

    await prisma.jobRun.create({
      data: { job: JOB, status: 'SUCCESS', finishedAt: new Date(), metrics },
    })
    return jobJson({ ok: true, metrics }, 200)
  } catch (error) {
    // Allow an immediate retry rather than blocking the next minute's schedule.
    await releaseIdempotencyKey(key)
    const message = error instanceof Error ? error.message : String(error)
    await prisma.jobRun.create({
      data: { job: JOB, status: 'FAILED', finishedAt: new Date(), error: message },
    })
    logger.error('job_failed', { job: JOB, message })
    return jobJson({ ok: false, error: 'Job failed' }, 500)
  }
}
