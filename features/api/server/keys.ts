import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { forbidden, notFound } from '@/shared/server/errors'
import { canManageMembers } from '@/shared/server/permissions'
import { recordAudit } from '@/features/organization/server/audit'

export const API_SCOPES = [
  'workflows:read',
  'tasks:read',
  'tasks:write',
  'instances:read',
  'instances:write',
] as const

export type ApiScope = (typeof API_SCOPES)[number]

export function isApiScope(scope: string): scope is ApiScope {
  return (API_SCOPES as readonly string[]).includes(scope)
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Creates an API key. The raw token is returned exactly once; only its hash is
 * persisted, so a database leak cannot be replayed.
 */
export async function createApiKey(ctx: Context, input: { name: string; scopes: string[] }) {
  if (!canManageMembers(ctx.role)) {
    throw forbidden('Managing API keys requires the Admin role or higher')
  }

  const scopes = input.scopes.filter(isApiScope)
  const token = `rk_${randomBytes(24).toString('base64url')}`
  const prefix = `${token.slice(0, 12)}…`

  const apiKey = await prisma.$transaction(async (tx) => {
    const created = await tx.apiKey.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name,
        prefix,
        keyHash: hashToken(token),
        scopes,
        createdById: ctx.userId,
      },
    })
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'api_key.created',
      targetType: 'api_key',
      targetId: created.id,
      metadata: { name: input.name, scopes },
    })
    return created
  })

  return { apiKey, token }
}

export async function listApiKeys(ctx: Context) {
  if (!canManageMembers(ctx.role)) {
    throw forbidden('Managing API keys requires the Admin role or higher')
  }
  return prisma.apiKey.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  })
}

export async function revokeApiKey(ctx: Context, id: string) {
  if (!canManageMembers(ctx.role)) {
    throw forbidden('Managing API keys requires the Admin role or higher')
  }
  const existing = await prisma.apiKey.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!existing) throw notFound('API key not found')

  await prisma.$transaction(async (tx) => {
    await tx.apiKey.update({ where: { id: existing.id }, data: { revokedAt: new Date() } })
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'api_key.revoked',
      targetType: 'api_key',
      targetId: existing.id,
    })
  })
}

export interface ApiKeyPrincipal {
  apiKeyId: string
  organizationId: string
  userId: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  scopes: string[]
}

/**
 * Authenticates a bearer token. The key acts with the *current* role of the user
 * who created it — if that user is removed or demoted, the key's authority
 * shrinks accordingly (keys are not a way to retain access).
 */
export async function authenticateApiKey(token: string): Promise<ApiKeyPrincipal | null> {
  if (!token || !token.startsWith('rk_')) return null

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hashToken(token) },
    select: {
      id: true,
      organizationId: true,
      scopes: true,
      revokedAt: true,
      createdById: true,
    },
  })
  if (!apiKey || apiKey.revokedAt) return null

  const membership = await prisma.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: apiKey.organizationId,
        userId: apiKey.createdById,
      },
    },
    select: { role: true },
  })
  if (!membership) return null

  // Best-effort usage tracking; never blocks the request.
  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined)

  return {
    apiKeyId: apiKey.id,
    organizationId: apiKey.organizationId,
    userId: apiKey.createdById,
    role: membership.role,
    scopes: apiKey.scopes,
  }
}

export function hasScope(principal: ApiKeyPrincipal, scope: ApiScope): boolean {
  return principal.scopes.includes(scope)
}
