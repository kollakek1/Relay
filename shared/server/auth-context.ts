import { headers } from 'next/headers'
import type { OrgRole } from '@/prisma/generated/prisma/enums'
import { auth } from '@/shared/lib/auth'
import { prisma } from '@/shared/lib/prisma'
import { forbidden, unauthorized } from './errors'
import { hasOrgRole } from './permissions'
import type { Context } from './context'

export interface SessionUser {
  id: string
  name: string
  email: string
  image?: string | null
}

/** Raw Better Auth session, or `null` when the request is anonymous. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession()
  if (!session?.user) return null
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  }
}

/**
 * Resolves the authorization context for the current request: the authenticated
 * user plus their active organization membership (the oldest membership is the
 * active workspace in the MVP). Returns `null` for anonymous users or users
 * without a membership.
 */
export async function getContext(): Promise<Context | null> {
  const session = await getSession()
  if (!session?.user) return null

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    select: { organizationId: true, role: true },
  })

  if (!membership) return null

  return {
    userId: session.user.id,
    organizationId: membership.organizationId,
    role: membership.role,
  }
}

/** Like {@link getContext} but throws when unauthenticated / org-less. */
export async function requireContext(): Promise<Context> {
  const ctx = await getContext()
  if (!ctx) throw unauthorized('You must be signed in to a workspace')
  return ctx
}

/** Requires the caller to hold at least `minimum` in the active organization. */
export async function requireRole(minimum: OrgRole): Promise<Context> {
  const ctx = await requireContext()
  if (!hasOrgRole(ctx.role, minimum)) {
    throw forbidden(`This action requires the ${minimum} role or higher`)
  }
  return ctx
}
