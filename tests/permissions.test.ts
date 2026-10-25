import { describe, expect, it } from 'vitest'
import {
  can,
  canManageMembers,
  canManageWorkflows,
  canWorkOnTasks,
  hasOrgRole,
  isOwner,
  isPermission,
  PERMISSIONS,
  permissionsFor,
  roleCan,
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

describe('permission catalogue', () => {
  it('denies by default: an unknown permission is not in the catalogue', () => {
    expect(isPermission('workflow.start')).toBe(true)
    expect(isPermission('workflow.launch')).toBe(false)
    expect(isPermission('')).toBe(false)
  })

  it('gives MEMBER no process-launching or management permissions', () => {
    const member = permissionsFor('MEMBER')
    expect(member).toContain('task.claim')
    expect(member).toContain('task.execute')
    expect(member).not.toContain('workflow.start')
    expect(member).not.toContain('workflow.delete')
    expect(member).not.toContain('member.manage')
  })

  it('adds explicit grants on top of the role baseline', () => {
    const granted = permissionsFor('MEMBER', ['workflow.start'])
    expect(granted).toContain('workflow.start')
    expect(can({ role: 'MEMBER', permissions: granted }, 'workflow.start')).toBe(true)
  })

  it('ignores unknown grant values and never over-grants', () => {
    const granted = permissionsFor('MEMBER', ['not.a.permission', 'workflow.start'])
    expect(granted).not.toContain('not.a.permission' as never)
    expect(granted).toContain('workflow.start')
  })

  it('falls back to the role baseline when permissions are omitted', () => {
    expect(can({ role: 'ADMIN' }, 'workflow.publish')).toBe(true)
    expect(can({ role: 'MEMBER' }, 'workflow.publish')).toBe(false)
  })

  it('keeps the legacy role helpers aligned with the catalogue', () => {
    for (const permission of PERMISSIONS) {
      expect(roleCan('OWNER', permission)).toBe(true)
    }
  })
})
