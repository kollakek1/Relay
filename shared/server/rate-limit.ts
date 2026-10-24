import { prisma } from '@/shared/lib/prisma'
import { AppError } from './errors'

export interface RateLimitRule {
  /** Maximum number of calls allowed inside the window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

/**
 * Named rules for the endpoints that need throttling. Kept in one place so the
 * policy is easy to audit.
 */
export const RATE_LIMITS = {
  inviteCreate: { limit: 20, windowMs: 60 * 60 * 1000 },
  inviteAccept: { limit: 20, windowMs: 15 * 60 * 1000 },
  commentCreate: { limit: 60, windowMs: 60 * 1000 },
  taskClaim: { limit: 120, windowMs: 60 * 1000 },
  taskMutate: { limit: 120, windowMs: 60 * 1000 },
  workflowMutate: { limit: 60, windowMs: 60 * 1000 },
  instanceRun: { limit: 30, windowMs: 60 * 1000 },
  orgMutate: { limit: 60, windowMs: 60 * 1000 },
  search: { limit: 120, windowMs: 60 * 1000 },
  export: { limit: 10, windowMs: 60 * 1000 },
  apiRequest: { limit: 300, windowMs: 60 * 1000 },
} satisfies Record<string, RateLimitRule>

/**
 * Fixed-window rate limiter backed by PostgreSQL.
 *
 * The increment and window reset happen in a single atomic upsert, so
 * concurrent invocations across serverless instances observe a consistent
 * counter. Throws `RATE_LIMITED` (429) when the limit is exceeded.
 */
export async function enforceRateLimit(key: string, rule: RateLimitRule): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "rate_limit_bucket" ("key", "count", "windowStart", "expiresAt")
    VALUES (${key}, 1, now(), now() + (${rule.windowMs}::int * interval '1 millisecond'))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit_bucket"."expiresAt" < now() THEN 1
        ELSE "rate_limit_bucket"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "rate_limit_bucket"."expiresAt" < now() THEN now()
        ELSE "rate_limit_bucket"."windowStart"
      END,
      "expiresAt" = CASE
        WHEN "rate_limit_bucket"."expiresAt" < now()
          THEN now() + (${rule.windowMs}::int * interval '1 millisecond')
        ELSE "rate_limit_bucket"."expiresAt"
      END
    RETURNING "count"
  `

  const count = Number(rows[0]?.count ?? 1)
  if (count > rule.limit) {
    throw new AppError('RATE_LIMITED', 'Too many requests. Please try again shortly.')
  }
}

/**
 * Convenience wrapper that namespaces the counter by action + actor so different
 * actions and users never share a bucket.
 */
export function rateLimit(action: string, identifier: string, rule: RateLimitRule) {
  return enforceRateLimit(`rl:${action}:${identifier}`, rule)
}

/** Deletes expired counters (called from the maintenance job). */
export async function pruneRateLimitBuckets(): Promise<number> {
  const result = await prisma.rateLimitBucket.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  return result.count
}
