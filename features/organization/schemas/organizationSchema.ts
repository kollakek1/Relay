import { z } from 'zod'
import type { TFunction } from '@/shared/i18n/translate'

export const orgRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER'])

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
})

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  description: z.string().trim().max(500).optional(),
  timezone: z.string().trim().min(1).max(64),
})

export const updateMemberRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: orgRoleSchema,
})

export const removeMemberSchema = z.object({
  membershipId: z.string().min(1),
})

export const transferOwnershipSchema = z.object({
  membershipId: z.string().min(1),
})

export const createInvitationSchema = z.object({
  email: z.email('Enter a valid email address'),
  role: orgRoleSchema.default('MEMBER'),
})

export const invitationIdSchema = z.object({ invitationId: z.string().min(1) })

export const switchOrganizationSchema = z.object({ organizationId: z.string().min(1) })

export const acceptInvitationSchema = z.object({ token: z.string().min(10) })

/**
 * Localized variants for client forms. The exported schemas above stay in
 * English so server actions keep stable, English validation messages; client
 * components build these instead.
 */
export function createCreateOrganizationSchema(t: TFunction) {
  return z.object({
    name: z.string().trim().min(2, t('validation.nameMin')).max(80),
  })
}

export function createUpdateOrganizationSchema(t: TFunction) {
  return z.object({
    name: z.string().trim().min(2, t('validation.nameMin')).max(80),
    description: z.string().trim().max(500).optional(),
    timezone: z.string().trim().min(1).max(64),
  })
}

export function createCreateInvitationSchema(t: TFunction) {
  return z.object({
    email: z.email(t('validation.email')),
    role: orgRoleSchema.default('MEMBER'),
  })
}

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>
