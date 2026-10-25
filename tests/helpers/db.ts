import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { permissionsFor } from '@/shared/server/permissions'
import type { OrgRole } from '@/prisma/generated/prisma/enums'

const createdUserIds: string[] = []
const createdOrgIds: string[] = []

function token() {
  return Math.random().toString(36).slice(2, 12)
}

export async function createTestUser(name = 'Test User') {
  const id = `test_${token()}`
  const user = await prisma.user.create({
    data: { id, name, email: `${id}@relay.test`, emailVerified: true, role: 'USER' },
  })
  createdUserIds.push(user.id)
  return user
}

export async function createTestOrganization(ownerId: string, name = 'Test Org') {
  const organization = await prisma.organization.create({
    data: { name, slug: `test-${token()}` },
  })
  createdOrgIds.push(organization.id)
  await prisma.membership.create({
    data: { organizationId: organization.id, userId: ownerId, role: 'OWNER' },
  })
  return organization
}

export async function addMember(organizationId: string, userId: string, role: OrgRole) {
  await prisma.membership.create({ data: { organizationId, userId, role } })
}

/** Creates a fresh user + organization and returns an authorization context. */
export async function createContext(role: OrgRole = 'OWNER'): Promise<Context> {
  const user = await createTestUser(`User ${token()}`)
  const organization = await createTestOrganization(user.id)
  if (role !== 'OWNER') {
    await prisma.membership.updateMany({
      where: { organizationId: organization.id, userId: user.id },
      data: { role },
    })
  }
  return { userId: user.id, organizationId: organization.id, role, permissions: permissionsFor(role) }
}

export function trackUser(id: string) {
  createdUserIds.push(id)
}

export function trackOrganization(id: string) {
  createdOrgIds.push(id)
}

export async function cleanupDatabase() {
  if (createdOrgIds.length > 0) {
    await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } })
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  }
  createdOrgIds.length = 0
  createdUserIds.length = 0
}

export async function disconnect() {
  await prisma.$disconnect()
}
