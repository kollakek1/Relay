import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/shared/lib/prisma'
import { enforceRateLimit, pruneRateLimitBuckets } from '@/shared/server/rate-limit'
import { disconnect } from './helpers/db'

const key = (name: string) => `rl:test:${name}:${Math.random().toString(36).slice(2)}`

describe('db-backed rate limiter', () => {
  afterAll(async () => {
    await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: 'rl:test:' } } })
    await disconnect()
  })

  it('allows calls up to the limit and then rejects with RATE_LIMITED', async () => {
    const k = key('basic')
    const rule = { limit: 3, windowMs: 60_000 }

    await enforceRateLimit(k, rule)
    await enforceRateLimit(k, rule)
    await enforceRateLimit(k, rule)

    await expect(enforceRateLimit(k, rule)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('resets the counter once the window expires', async () => {
    const k = key('window')
    const rule = { limit: 1, windowMs: 60_000 }

    await enforceRateLimit(k, rule)
    await expect(enforceRateLimit(k, rule)).rejects.toMatchObject({ code: 'RATE_LIMITED' })

    // Force the window into the past.
    await prisma.rateLimitBucket.update({
      where: { key: k },
      data: { expiresAt: new Date(Date.now() - 1000), windowStart: new Date(Date.now() - 2000) },
    })

    await enforceRateLimit(k, rule) // should succeed again
    const bucket = await prisma.rateLimitBucket.findUniqueOrThrow({ where: { key: k } })
    expect(bucket.count).toBe(1)
  })

  it('is atomic under concurrency: exactly `limit` of many calls succeed', async () => {
    const k = key('race')
    const rule = { limit: 3, windowMs: 60_000 }

    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => enforceRateLimit(k, rule))
    )
    const ok = results.filter((r) => r.status === 'fulfilled').length
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(ok).toBe(3)
    expect(rejected).toHaveLength(9)
    for (const r of rejected) expect((r as PromiseRejectedResult).reason).toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('prunes expired buckets', async () => {
    const k = key('prune')
    await enforceRateLimit(k, { limit: 5, windowMs: 60_000 })
    await prisma.rateLimitBucket.update({
      where: { key: k },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const pruned = await pruneRateLimitBuckets()
    expect(pruned).toBeGreaterThanOrEqual(1)
    expect(await prisma.rateLimitBucket.findUnique({ where: { key: k } })).toBeNull()
  })
})
