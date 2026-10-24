import { prisma } from '@/shared/lib/prisma'
import { invalid } from '@/shared/server/errors'

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

/**
 * Creates an organization and makes `userId` its OWNER, atomically.
 */
export async function createOrganizationForUser(userId: string, name: string) {
  const trimmed = name.trim()
  if (trimmed.length < 2) throw invalid('Organization name is too short')

  const slug = `${slugify(trimmed) || 'workspace'}-${Math.random().toString(36).slice(2, 8)}`

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { name: trimmed, slug } })
    await tx.membership.create({
      data: { organizationId: organization.id, userId, role: 'OWNER' },
    })
    return organization
  })
}

/**
 * Returns the user's active organization id, creating a personal workspace on
 * first login. Idempotent — safe to call on every dashboard visit.
 */
export async function ensureOrganization(userId: string): Promise<string> {
  const existing = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { organizationId: true },
  })
  if (existing) return existing.organizationId

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  const organization = await createOrganizationForUser(userId, `${user?.name ?? 'My'}'s Workspace`)
  return organization.id
}
