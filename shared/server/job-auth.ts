/**
 * Shared auth + boilerplate for cron-triggered maintenance endpoints.
 *
 * Jobs are protected by a single `CRON_SECRET` (header or query). When the
 * secret is not configured the endpoint returns 503 rather than pretending to
 * have run.
 */
export function jobSecret(): string | undefined {
  return process.env.CRON_SECRET
}

export function isJobAuthorized(request: Request): boolean {
  const secret = jobSecret()
  if (!secret) return false
  const header = request.headers.get('authorization')
  const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  const query = new URL(request.url).searchParams.get('secret')
  return bearer === secret || query === secret
}

export function jobJson(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
