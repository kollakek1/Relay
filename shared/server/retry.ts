/**
 * Shared retry / lease policy for the outbox, webhook delivery and automation
 * runners.
 *
 * Delivery is **at-least-once**: a row is claimed with a lease, and if the
 * worker dies before it completes, the lease expires and the next run reclaims
 * the work. Side effects must therefore be idempotent (they are: fan-out uses a
 * unique index, automation runs use a unique (rule, event) key).
 */

/** How long a claimed row stays owned before another run may reclaim it. */
export const DEFAULT_LEASE_MS = 5 * 60 * 1000

/** Maximum processing attempts before a row is dead-lettered (`FAILED`). */
export const DEFAULT_MAX_ATTEMPTS = 6

const BASE_BACKOFF_MS = 30_000
const MAX_BACKOFF_MS = 60 * 60 * 1000

/**
 * Exponential backoff with jitter: `min(base · 2^(attempts-1), cap) ± jitter%`.
 * Jitter decorrelates retries so a batch of failures does not stampede together.
 */
export function backoffWithJitter(
  attempts: number,
  options: { baseMs?: number; capMs?: number; jitter?: number; random?: () => number } = {}
): number {
  const base = options.baseMs ?? BASE_BACKOFF_MS
  const cap = options.capMs ?? MAX_BACKOFF_MS
  const jitter = options.jitter ?? 0.2
  const random = options.random ?? Math.random

  const safeAttempts = Math.max(1, Math.floor(attempts))
  const raw = Math.min(base * 2 ** (safeAttempts - 1), cap)
  const spread = raw * jitter
  const value = raw - spread + random() * spread * 2
  return Math.max(0, Math.round(value))
}

/** Next attempt timestamp for a row that just failed for the `attempts`-th time. */
export function nextAttemptAt(attempts: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + backoffWithJitter(attempts))
}
