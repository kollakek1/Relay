import { cookies, headers } from 'next/headers'
import type { OrgRole } from '@/prisma/generated/prisma/enums'
import { auth } from '@/shared/lib/auth'
import { prisma } from '@/shared/lib/prisma'
import { forbidden, unauthorized } from './errors'
import { can, hasOrgRole, permissionsFor, type Permission } from './permissions'
import { canAccess, type AreaKey } from './access'
import type { Context } from './context'

export const ACTIVE_ORG_COOKIE = 'relay_org'

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
 * user plus their **active** organization membership.
 *
 * The active workspace is read from a cookie but is *always* re-validated
 * against a real membership, so the cookie is a preference, never an authority.
 * When absent (or stale) the oldest membership is used as a fallback.
 */
export async function getContext(): Promise<Context | null> {
  const session = await getSession()
  if (!session?.user) return null
  const activeId = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value
  return resolveContext(session.user.id, activeId)
}

/**
 * Pure-ish resolver (only touches the DB): returns the context for `userId`,
 * preferring `activeOrganizationId` **only if it is a real membership**, else
 * falling back to the oldest membership. Exposed for testing.
 */
export async function resolveContext(
  userId: string,
  activeOrganizationId?: string | null
): Promise<Context | null> {
  if (activeOrganizationId) {
    const active = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: activeOrganizationId, userId } },
      select: { organizationId: true, role: true, grantedPermissions: true },
    })
    if (active) {
      return {
        userId,
        organizationId: active.organizationId,
        role: active.role,
        permissions: permissionsFor(active.role, active.grantedPermissions),
      }
    }
  }

  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { organizationId: true, role: true, grantedPermissions: true },
  })

  if (!membership) return null

  return {
    userId,
    organizationId: membership.organizationId,
    role: membership.role,
    permissions: permissionsFor(membership.role, membership.grantedPermissions),
  }
}

/**
 * Persists the active workspace preference. Only callable from a Server Action
 * or Route Handler (where cookies are writable). Membership is validated by the
 * caller before this is invoked.
 */
export async function setActiveOrganizationCookie(organizationId: string): Promise<void> {
  const store = await cookies()
  store.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
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

/**
 * Requires the caller's *effective* permissions (role baseline plus grants) to
 * include `permission`. This is the preferred guard for server actions and
 * route handlers: hiding a button is never the control.
 */
export async function requirePermission(
  permission: Permission,
  message = 'You do not have permission to perform this action'
): Promise<Context> {
  const ctx = await requireContext()
  if (!can(ctx, permission)) {
    throw forbidden(message)
  }
  return ctx
}

/**
 * Requires access to a whole product area (see {@link AREA_ACCESS}). Used by the
 * protected pages so a direct URL to a hidden area is refused on the server.
 */
export async function requireAreaAccess(
  area: AreaKey,
  message = 'You do not have access to this area'
): Promise<Context> {
  const ctx = await requireContext()
  if (!canAccess(ctx, area)) {
    throw forbidden(message)
  }
  return ctx
}
