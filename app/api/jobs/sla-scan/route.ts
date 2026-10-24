import type { Prisma } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'
import { claimIdempotencyKey } from '@/shared/server/idempotency'
import { logger } from '@/shared/server/logger'
import { runSlaScan } from '@/features/sla/server/service'

export const dynamic = 'force-dynamic'

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Accepts `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`. */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  const query = new URL(request.url).searchParams.get('secret')
  return bearer === secret || query === secret
}

/**
 * Scheduled SLA scan. Idempotent per hour: repeated triggers within the same hour
 * are no-ops. Safe to expose to any cron/scheduler — no long-running process is
 * required, each call does a bounded amount of work and records a JobRun.
 */
async function handle(request: Request): Promise<Response> {
  if (!process.env.CRON_SECRET) {
    // Honest: the job is not configured, not "succeeded".
    return json({ ok: false, error: 'CRON_SECRET is not configured' }, 503)
  }
  if (!isAuthorized(request)) {
    return json({ ok: false, error: 'Unauthorized' }, 401)
  }

  const startedAt = new Date()
  const bucket = startedAt.toISOString().slice(0, 13) // YYYY-MM-DDTHH
  const claimed = await claimIdempotencyKey(`job:sla-scan:${bucket}`, 'job', 2 * 60 * 60 * 1000)
  if (!claimed) {
    return json({ ok: true, skipped: true, reason: 'already ran this hour' }, 200)
  }

  try {
    const metrics = await runSlaScan(startedAt)
    await prisma.jobRun.create({
      data: {
        job: 'sla-scan',
        status: 'SUCCESS',
        finishedAt: new Date(),
        metrics: metrics as unknown as Prisma.InputJsonValue,
      },
    })
    return json({ ok: true, metrics }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.jobRun.create({
      data: { job: 'sla-scan', status: 'FAILED', finishedAt: new Date(), error: message },
    })
    logger.error('job_failed', { job: 'sla-scan', message })
    return json({ ok: false, error: 'Job failed' }, 500)
  }
}

export const GET = handle
export const POST = handle
