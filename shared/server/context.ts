import type { OrgRole } from '@/prisma/generated/prisma/enums'

/**
 * The authorization context every service function receives. It carries the
 * *tenant* (`organizationId`) and the caller's role within it, so services
 * never have to re-derive them and can always scope queries to the tenant.
 *
 * Keeping this type free of `next/headers` imports makes the service layer
 * importable from unit/integration tests.
 */
export interface Context {
  userId: string
  organizationId: string
  role: OrgRole
}

/** Default page size for list endpoints. */
export const DEFAULT_PAGE_SIZE = 20
