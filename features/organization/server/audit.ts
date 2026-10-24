import type { Prisma } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'

type Db = Prisma.TransactionClient | typeof prisma

export interface AuditInput {
  organizationId: string
  actorId: string | null
  action: string
  targetType?: string
  targetId?: string
  metadata?: Prisma.InputJsonValue
}

/**
 * Appends an administrative audit entry. Accepts a transaction client so the
 * audit row is written atomically with the action it describes. The table is
 * treated as append-only (no code path updates or deletes it).
 */
export async function recordAudit(db: Db, input: AuditInput) {
  return db.orgAuditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? undefined,
    },
  })
}

export async function listAuditLog(ctxOrganizationId: string, limit = 50) {
  return prisma.orgAuditLog.findMany({
    where: { organizationId: ctxOrganizationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { actor: { select: { id: true, name: true } } },
  })
}
