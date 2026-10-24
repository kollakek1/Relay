import { z } from 'zod'

export const orgRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER'])

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
})

export const updateMemberRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: orgRoleSchema,
})

export const removeMemberSchema = z.object({
  membershipId: z.string().min(1),
})

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>
