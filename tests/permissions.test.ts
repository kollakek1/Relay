import { describe, expect, it } from 'vitest'
import {
  canManageMembers,
  canManageWorkflows,
  canWorkOnTasks,
  hasOrgRole,
  isOwner,
  roleRank,
} from '@/shared/server/permissions'

describe('organization role hierarchy', () => {
  it('orders OWNER > ADMIN > MEMBER', () => {
    expect(roleRank('OWNER')).toBeGreaterThan(roleRank('ADMIN'))
    expect(roleRank('ADMIN')).toBeGreaterThan(roleRank('MEMBER'))
  })

  it('implements hasOrgRole as a lower bound', () => {
    expect(hasOrgRole('OWNER', 'ADMIN')).toBe(true)
    expect(hasOrgRole('ADMIN', 'ADMIN')).toBe(true)
    expect(hasOrgRole('MEMBER', 'ADMIN')).toBe(false)
    expect(hasOrgRole('MEMBER', 'MEMBER')).toBe(true)
  })

  it('gates workflow / member management to ADMIN+, task work to everyone', () => {
    expect(canManageWorkflows('MEMBER')).toBe(false)
    expect(canManageWorkflows('ADMIN')).toBe(true)
    expect(canManageMembers('MEMBER')).toBe(false)
    expect(canWorkOnTasks('MEMBER')).toBe(true)
    expect(isOwner('ADMIN')).toBe(false)
    expect(isOwner('OWNER')).toBe(true)
  })
})
