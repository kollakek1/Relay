import type { OrgRole } from '@/prisma/generated/prisma/enums'
import type { Permission } from './permissions'

/**
 * The authorization context every service function receives. It carries the
 * *tenant* (`organizationId`), the caller's role within it, and the caller's
 * **effective permissions** (the role baseline plus any per-membership grants),
 * so services never have to re-derive them and can always scope queries to the
 * tenant and check authority through a single list.
 *
 * Keeping this type free of `next/headers` imports makes the service layer
 * importable from unit/integration tests.
 */
export interface Context {
  userId: string
  organizationId: string
  role: OrgRole
  /**
   * Effective permissions (role baseline plus per-membership grants). Populated
   * by {@link getContext} and the public-API handler. When omitted, checks fall
   * back to the role baseline — never to *more* than the role allows — so a
   * context can never silently escalate authority.
   */
  permissions?: readonly Permission[]
}

/** Default page size for list endpoints. */
export const DEFAULT_PAGE_SIZE = 20
