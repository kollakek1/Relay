import { timingSafeEqual } from 'node:crypto'

/**
 * Shared auth + boilerplate for cron-triggered maintenance endpoints.
 *
 * Jobs are protected by a single `CRON_SECRET` supplied as
 * `Authorization: Bearer <secret>` over HTTPS. The secret is **never** accepted
 * from the query string (it would leak through access logs, proxies, referrers
 * and analytics) and is compared in constant time. When the secret is not
 * configured the endpoint returns 503 rather than pretending to have run.
 */

export function jobSecret(): string | undefined {
  const secret = process.env.CRON_SECRET
  return secret && secret.length > 0 ? secret : undefined
}

/** Constant-time string comparison that never short-circuits on length. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) {
    // Still perform a comparison so the timing does not reveal the length.
    timingSafeEqual(left, left)
    return false
  }
  return timingSafeEqual(left, right)
}

export function isJobAuthorized(request: Request): boolean {
  const secret = jobSecret()
  if (!secret) return false

  const header = request.headers.get('authorization')
  if (!header || !header.startsWith('Bearer ')) return false

  const presented = header.slice('Bearer '.length).trim()
  if (presented.length === 0) return false

  return safeEqual(presented, secret)
}

export function jobJson(body: unknown, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  })
}

/**
 * Standard guard for a state-changing job endpoint. Returns a `Response` to
 * send back when the request must be rejected, or `null` when it may proceed.
 * Only `POST` is accepted — `GET` is never wired up, so Next.js answers 405.
 */
export function guardJobRequest(request: Request): Response | null {
  if (!jobSecret()) {
    return jobJson({ ok: false, error: 'CRON_SECRET is not configured' }, 503)
  }
  if (!isJobAuthorized(request)) {
    return jobJson({ ok: false, error: 'Unauthorized' }, 401)
  }
  return null
}
