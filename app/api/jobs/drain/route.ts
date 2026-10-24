import { prisma } from '@/shared/lib/prisma'
import { isJobAuthorized, jobJson, jobSecret } from '@/shared/server/job-auth'
import { logger } from '@/shared/server/logger'
import { pruneIdempotencyKeys } from '@/shared/server/idempotency'
import { claimIdempotencyKey } from '@/shared/server/idempotency'
import { drainOutbox } from '@/features/webhooks/server/delivery'

export const dynamic = 'force-dynamic'

async function handle(request: Request): Promise<Response> {
  if (!jobSecret()) {
    return jobJson({ ok: false, error: 'CRON_SECRET is not configured' }, 503)
  }
  if (!isJobAuthorized(request)) {
    return jobJson({ ok: false, error: 'Unauthorized' }, 401)
  }

  const startedAt = new Date()
  const bucket = startedAt.toISOString().slice(0, 16) // per-minute bucket
  const claimed = await claimIdempotencyKey(`job:outbox-drain:${bucket}`, 'job', 5 * 60 * 1000)
  if (!claimed) {
    return jobJson({ ok: true, skipped: true, reason: 'already ran this minute' }, 200)
  }

  try {
    const result = await drainOutbox({ now: startedAt })
    const prunedKeys = await pruneIdempotencyKeys()
    await prisma.jobRun.create({
      data: {
        job: 'outbox-drain',
        status: 'SUCCESS',
        finishedAt: new Date(),
        metrics: { ...result, prunedKeys },
      },
    })
    return jobJson({ ok: true, metrics: { ...result, prunedKeys } }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.jobRun.create({
      data: { job: 'outbox-drain', status: 'FAILED', finishedAt: new Date(), error: message },
    })
    logger.error('job_failed', { job: 'outbox-drain', message })
    return jobJson({ ok: false, error: 'Job failed' }, 500)
  }
}

export const GET = handle
export const POST = handle
