import { prisma } from '@/shared/lib/prisma'

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  )
}

/**
 * Atomically claims a unit of work. Returns `true` if the caller should do the
 * work, `false` if it was already done (unique-key violation). This is how
 * at-least-once triggers (cron, retries) become effectively-once without any
 * in-memory coordination.
 */
export async function claimIdempotencyKey(
  key: string,
  scope: string,
  ttlMs: number
): Promise<boolean> {
  try {
    await prisma.idempotencyKey.create({
      data: { key, scope, expiresAt: new Date(Date.now() + ttlMs) },
    })
    return true
  } catch (error) {
    if (isUniqueViolation(error)) return false
    throw error
  }
}

/**
 * Releases a claim so the unit of work can be retried immediately. Call this
 * when the claimed work *failed*, otherwise the key would block every retry for
 * the whole TTL. Best-effort: a failed release simply means the TTL applies.
 */
export async function releaseIdempotencyKey(key: string): Promise<void> {
  await prisma.idempotencyKey.deleteMany({ where: { key } }).catch(() => undefined)
}

export async function pruneIdempotencyKeys(): Promise<number> {
  const result = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  return result.count
}
