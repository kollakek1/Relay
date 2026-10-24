import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * Outbound HTTP safety (SSRF guard).
 *
 * Webhook and automation URLs are attacker-influenced. Before any request we:
 *  1. reject non-http(s) schemes and embedded credentials,
 *  2. reject hostnames that are obviously local/metadata,
 *  3. reject IP literals in loopback / private / link-local / multicast /
 *     reserved ranges (including IPv4-mapped, NAT64 and 6to4 forms),
 *  4. reject non-standard ports unless explicitly allow-listed,
 *  5. **resolve the hostname and re-check every returned address**, then
 *     connect through {@link safeFetch} which never follows redirects and
 *     bounds the response size and time.
 *
 * Residual risk: DNS rebinding between step 5's lookup and the connection the
 * runtime opens. This is a narrow TOCTOU window; closing it fully needs a
 * connect-time pinned socket / egress proxy (documented in
 * `docs/KNOWN_LIMITATIONS.md`). We prefer a resolve-then-check that blocks the
 * realistic attack (attacker-controlled DNS returning a private address).
 */

export type UrlCheck = { ok: true } | { ok: false; reason: string }

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  'kubernetes.default',
])

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/** Ports an outbound webhook may target. Override with `OUTBOUND_ALLOWED_PORTS`. */
function allowedPorts(): Set<number> {
  const raw = process.env.OUTBOUND_ALLOWED_PORTS
  if (raw) {
    const parsed = raw
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0 && value <= 65535)
    if (parsed.length > 0) return new Set(parsed)
  }
  return new Set([80, 443, 8080, 8443])
}

// --- IPv4 -------------------------------------------------------------------

function ipv4ToInt(host: string): number | null {
  const parts = host.split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    value = value * 256 + octet
  }
  return value >>> 0
}

const IPV4_BLOCKED_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local + cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + 255.255.255.255
]

function isBlockedIpv4(host: string): boolean {
  const value = ipv4ToInt(host)
  if (value === null) return false
  return IPV4_BLOCKED_RANGES.some(([base, bits]) => {
    const baseInt = ipv4ToInt(base)!
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (value & mask) >>> 0 === (baseInt & mask) >>> 0
  })
}

// --- IPv6 -------------------------------------------------------------------

function ipv6ToWords(host: string): number[] | null {
  let address = host
  if (address.includes('%')) address = address.slice(0, address.indexOf('%')) // zone id

  // A trailing dotted-quad (e.g. ::ffff:127.0.0.1) becomes two hextets.
  const v4Match = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address)
  let v4Words: number[] = []
  if (v4Match) {
    const int = ipv4ToInt(v4Match[1])
    if (int === null) return null
    v4Words = [(int >>> 16) & 0xffff, int & 0xffff]
    address = address.slice(0, address.length - v4Match[1].length)
    if (address.endsWith(':')) address = address.slice(0, -1)
  }

  const halves = address.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []

  const toWord = (part: string): number | null =>
    /^[0-9a-f]{1,4}$/.test(part) ? parseInt(part, 16) : null

  const headWords: number[] = []
  for (const part of head) {
    const word = toWord(part)
    if (word === null) return null
    headWords.push(word)
  }
  const tailWords: number[] = []
  for (const part of tail) {
    const word = toWord(part)
    if (word === null) return null
    tailWords.push(word)
  }

  const known = headWords.length + tailWords.length + v4Words.length
  if (halves.length === 2) {
    if (known > 8) return null
    const zeros = new Array(8 - known).fill(0)
    return [...headWords, ...zeros, ...tailWords, ...v4Words]
  }
  if (known !== 8) return null
  return [...headWords, ...v4Words]
}

interface IpV6Range {
  /** Matches the parsed 8-hextet address. */
  matches: (words: number[]) => boolean
  /** When set, the embedded IPv4 (from ::ffff:, 64:ff9b:: or 6to4) decides. */
  embeddedV4?: 'mapped' | 'sixto4'
}

function prefixWords(words: number[], count: number): number[] {
  return words.slice(0, count)
}

function wordsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((word, index) => word === b[index])
}

function allZero(words: number[]): boolean {
  return words.every((word) => word === 0)
}

function parsePrefix(prefix: string): number[] {
  return ipv6ToWords(prefix.replace(/^\[|\]$/g, ''))!
}

const IPV6_BLOCKED_RANGES: IpV6Range[] = [
  // ::  (unspecified)
  { matches: (w) => allZero(w) },
  // ::1 (loopback)
  { matches: (w) => allZero(w.slice(0, 7)) && w[7] === 1 },
  // ::ffff:0:0/96 — IPv4-mapped
  {
    matches: (w) => allZero(w.slice(0, 5)) && w[5] === 0xffff,
    embeddedV4: 'mapped',
  },
  // 64:ff9b::/96 and 64:ff9b:1::/48 — NAT64
  {
    matches: (w) => wordsEqual(prefixWords(w, 5), [...parsePrefix('64:ff9b::').slice(0, 5)]),
    embeddedV4: 'mapped',
  },
  { matches: (w) => wordsEqual(prefixWords(w, 3), parsePrefix('64:ff9b:1::').slice(0, 3)) },
  // 100::/64 — discard-only
  { matches: (w) => w[0] === 0x0100 && allZero(w.slice(1, 4)) },
  // 2001::/32 — Teredo
  { matches: (w) => w[0] === 0x2001 && w[1] === 0 },
  // 2001:db8::/32 — documentation
  { matches: (w) => w[0] === 0x2001 && w[1] === 0x0db8 },
  // 2002::/16 — 6to4
  { matches: (w) => w[0] === 0x2002, embeddedV4: 'sixto4' },
  // fc00::/7 — unique local
  { matches: (w) => (w[0] & 0xfe00) === 0xfc00 },
  // fe80::/10 — link-local
  { matches: (w) => (w[0] & 0xffc0) === 0xfe80 },
  // ff00::/8 — multicast
  { matches: (w) => (w[0] & 0xff00) === 0xff00 },
]

function wordsToDottedIpv4(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.')
}

function isBlockedIpv6(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, '').toLowerCase()
  const words = ipv6ToWords(bare)
  if (!words) return false

  for (const range of IPV6_BLOCKED_RANGES) {
    if (!range.matches(words)) continue
    if (!range.embeddedV4) return true

    const embedded =
      range.embeddedV4 === 'mapped'
        ? wordsToDottedIpv4(words[6], words[7])
        : wordsToDottedIpv4(words[1], words[2])
    if (isBlockedIpv4(embedded)) return true
  }
  return false
}

/**
 * Classifies a single literal IP address. Returns `true` when the address must
 * not be dialed. Exported for tests.
 */
export function isBlockedIpLiteral(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, '')
  const family = isIP(bare)
  if (family === 4) return isBlockedIpv4(bare)
  if (family === 6) return isBlockedIpv6(bare)
  return false
}

/**
 * Synchronous, string-level validation. Safe to call at configuration time
 * (e.g. when a webhook endpoint is registered).
 */
export function checkOutboundUrl(raw: string): UrlCheck {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'Not a valid URL' }
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: 'Only http:// and https:// URLs are allowed' }
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'Credentials in the URL are not allowed' }
  }

  const host = url.hostname.toLowerCase()
  if (!host) return { ok: false, reason: 'Missing host' }

  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return { ok: false, reason: 'That host is not allowed' }
  }

  if (isBlockedIpLiteral(host)) {
    return { ok: false, reason: 'Private or reserved addresses are not allowed' }
  }

  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80
  if (!allowedPorts().has(port)) {
    return { ok: false, reason: `Port ${port} is not allowed for outbound requests` }
  }

  return { ok: true }
}

export type HostResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>

const defaultResolver: HostResolver = async (hostname) =>
  lookup(hostname, { all: true, verbatim: true })

/**
 * Resolves `raw`'s hostname and rejects it when *any* resolved address is
 * private/reserved. Returns the validated URL on success.
 */
export async function resolveAndAssertSafe(
  raw: string,
  resolver: HostResolver = defaultResolver
): Promise<URL> {
  const check = checkOutboundUrl(raw)
  if (!check.ok) throw new Error(`Blocked outbound URL: ${check.reason}`)

  const url = new URL(raw)
  const host = url.hostname.toLowerCase()

  // Literal IPs were already classified synchronously.
  if (isIP(host.replace(/^\[|\]$/g, '')) !== 0) return url

  let addresses: Array<{ address: string; family: number }>
  try {
    addresses = await resolver(host)
  } catch {
    throw new Error('Blocked outbound URL: could not resolve host')
  }
  if (addresses.length === 0) throw new Error('Blocked outbound URL: could not resolve host')

  for (const { address } of addresses) {
    if (isBlockedIpLiteral(address)) {
      throw new Error('Blocked outbound URL: host resolves to a private or reserved address')
    }
  }
  return url
}

export interface SafeFetchOptions {
  resolver?: HostResolver
  timeoutMs?: number
  /** Hard cap on the bytes we will read from the response body. */
  maxBytes?: number
}

const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_MAX_BYTES = 64 * 1024

/**
 * SSRF-safe `fetch`. Never follows redirects, always applies a timeout, and
 * reads at most `maxBytes` from the body (cancelling the rest) so a hostile
 * endpoint cannot exhaust memory or hold the connection open.
 */
export async function safeFetch(
  raw: string,
  init: RequestInit = {},
  options: SafeFetchOptions = {}
): Promise<Response> {
  await resolveAndAssertSafe(raw, options.resolver)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const response = await fetch(raw, {
      ...init,
      redirect: 'manual',
      signal: controller.signal,
    })

    const declaredLength = Number(response.headers.get('content-length') ?? '0')
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
    if (declaredLength > maxBytes) {
      await response.body?.cancel().catch(() => undefined)
      return new Response('', { status: response.status, headers: response.headers })
    }

    // Read at most `maxBytes`, then drop the rest of the stream.
    const reader = response.body?.getReader()
    if (!reader) return response
    let received = 0
    const chunks: Uint8Array[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      received += value.byteLength
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined)
        break
      }
      chunks.push(value)
    }
    const body = new Uint8Array(received > maxBytes ? maxBytes : received)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
    return new Response(body, { status: response.status, headers: response.headers })
  } finally {
    clearTimeout(timeout)
  }
}
