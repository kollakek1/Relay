/**
 * Outbound HTTP safety (SSRF guard).
 *
 * Webhook/automation URLs are attacker-influenced, so before any request we
 * reject non-http(s) schemes, embedded credentials, and hosts that resolve to
 * loopback / private / link-local / cloud-metadata addresses.
 *
 * This is a *string-level* check on the hostname. It blocks the common cases
 * (IP literals, localhost, metadata hostnames). A determined attacker could
 * still use DNS rebinding to point a public name at a private IP; production
 * deployments should additionally pin egress through a proxy or a
 * resolve-then-check step. Documented in `docs/THREAT_MODEL.md`.
 */
export type UrlCheck = { ok: true } | { ok: false; reason: string }

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
])

function isPrivateIpv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!match) return false
  const [a, b] = [Number(match[1]), Number(match[2])]
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // carrier-grade NAT
  return false
}

function isPrivateIpv6(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, '')
  if (bare === '::1' || bare === '::') return true
  const lower = bare.toLowerCase()
  return lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')
}

export function checkOutboundUrl(raw: string): UrlCheck {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'Not a valid URL' }
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: 'Only http:// and https:// URLs are allowed' }
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'Credentials in the URL are not allowed' }
  }

  const host = url.hostname.toLowerCase()
  if (!host) return { ok: false, reason: 'Missing host' }
  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: 'That host is not allowed' }
  }
  if (host.endsWith('.localhost') || host.endsWith('.internal')) {
    return { ok: false, reason: 'Internal hosts are not allowed' }
  }
  if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
    return { ok: false, reason: 'Private or link-local addresses are not allowed' }
  }

  return { ok: true }
}
