import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { can, permissionsFor, grantablePermissions } from '@/shared/server/permissions'
import { canAccess } from '@/shared/server/access'
import {
  archiveInstance,
  createWorkflow,
  listArchivedInstances,
  listInstances,
  publishWorkflow,
  restoreInstance,
  runInstance,
  saveWorkflowDraft,
} from '@/features/workflow/server/service'
import { claimTask, transitionTask } from '@/features/task/server/service'
import { updateMemberPermissions } from '@/features/organization/server/service'
import { cleanupDatabase, createContext, createTestUser, disconnect } from './helpers/db'

async function membershipFor(
  organizationId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER',
  granted: string[] = []
): Promise<Context & { membershipId: string }> {
  const user = await createTestUser(`Member ${Math.random().toString(36).slice(2)}`)
  const membership = await prisma.membership.create({
    data: { organizationId, userId: user.id, role, grantedPermissions: granted },
  })
  return {
    userId: user.id,
    organizationId,
    role,
    membershipId: membership.id,
    permissions: permissionsFor(role, granted),
  }
}

async function completedInstance(owner: Context) {
  const workflow = await createWorkflow(owner, { name: 'Archivable' })
  await saveWorkflowDraft(owner, {
    workflowId: workflow.id,
    name: 'Archivable',
    steps: [{ name: 'Only' }],
  })
  await publishWorkflow(owner, workflow.id)
  const instance = await runInstance(owner, workflow.id)
  const task = await prisma.task.findFirstOrThrow({ where: { instanceId: instance.id } })
  await claimTask(owner, task.id)
  await transitionTask(owner, { taskId: task.id, to: 'IN_PROGRESS' })
  await transitionTask(owner, { taskId: task.id, to: 'DONE' })
  return instance
}

describe('RBAC — launching processes', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('denies a plain MEMBER the right to start an instance', async () => {
    const owner = await createContext('OWNER')
    const workflow = await createWorkflow(owner, { name: 'Guarded' })
    await saveWorkflowDraft(owner, {
      workflowId: workflow.id,
      name: 'Guarded',
      steps: [{ name: 'A' }],
    })
    await publishWorkflow(owner, workflow.id)

    const member = await membershipFor(owner.organizationId, 'MEMBER')
    await expect(runInstance(member, workflow.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(can(member, 'workflow.start')).toBe(false)
  })

  it('allows a MEMBER who was explicitly granted workflow.start', async () => {
    const owner = await createContext('OWNER')
    const workflow = await createWorkflow(owner, { name: 'Granted' })
    await saveWorkflowDraft(owner, {
      workflowId: workflow.id,
      name: 'Granted',
      steps: [{ name: 'A' }],
    })
    await publishWorkflow(owner, workflow.id)

    const member = await membershipFor(owner.organizationId, 'MEMBER', ['workflow.start'])
    expect(can(member, 'workflow.start')).toBe(true)
    const instance = await runInstance(member, workflow.id)
    expect(instance.status).toBe('RUNNING')
  })

  it('still lets a MEMBER act on tasks even without workflow.start', async () => {
    const owner = await createContext('OWNER')
    const workflow = await createWorkflow(owner, { name: 'Taskable' })
    await saveWorkflowDraft(owner, {
      workflowId: workflow.id,
      name: 'Taskable',
      steps: [{ name: 'A' }],
    })
    await publishWorkflow(owner, workflow.id)
    const instance = await runInstance(owner, workflow.id)

    const member = await membershipFor(owner.organizationId, 'MEMBER')
    const task = await prisma.task.findFirstOrThrow({ where: { instanceId: instance.id } })
    await claimTask(member, task.id)
    await transitionTask(member, { taskId: task.id, to: 'IN_PROGRESS' })
    const done = await transitionTask(member, { taskId: task.id, to: 'DONE' })
    expect(done.status).toBe('DONE')
  })

  it('keeps ADMIN and OWNER powers', async () => {
    const admin = await createContext('ADMIN')
    expect(can(admin, 'workflow.start')).toBe(true)
    expect(can(admin, 'workflow.delete')).toBe(true)
    const owner = await createContext('OWNER')
    expect(can(owner, 'organization.manage')).toBe(true)
  })
})

describe('RBAC — permission grants', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('cannot grant a permission the actor does not hold', async () => {
    const owner = await createContext('OWNER')
    // A MEMBER who was allowed to manage members but still cannot launch or
    // publish must not be able to hand those powers to someone else.
    const delegator = await membershipFor(owner.organizationId, 'MEMBER', ['member.manage'])
    const target = await membershipFor(owner.organizationId, 'MEMBER')

    expect(can(delegator, 'member.manage')).toBe(true)
    expect(can(delegator, 'workflow.publish')).toBe(false)

    await expect(
      updateMemberPermissions(delegator, {
        membershipId: target.membershipId,
        permissions: ['workflow.start', 'workflow.publish'],
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('grants and normalises extra permissions, auditing the change', async () => {
    const admin = await createContext('ADMIN')
    const member = await membershipFor(admin.organizationId, 'MEMBER')

    await updateMemberPermissions(admin, {
      membershipId: member.membershipId,
      permissions: ['workflow.start', 'task.view'],
    })

    const stored = await prisma.membership.findUniqueOrThrow({
      where: { id: member.membershipId },
    })
    // `task.view` is already implied by MEMBER, so only the real grant is stored.
    expect(stored.grantedPermissions).toEqual(['workflow.start'])

    const audit = await prisma.orgAuditLog.findFirst({
      where: { organizationId: admin.organizationId, action: 'member.permissions_changed' },
    })
    expect(audit).not.toBeNull()
  })

  it('only reports permissions the actor actually holds as grantable', async () => {
    const owner = await createContext('OWNER')
    const admin = await membershipFor(owner.organizationId, 'ADMIN')
    const member = await membershipFor(owner.organizationId, 'MEMBER')

    // An ADMIN holds member.manage and may pass it on...
    expect(grantablePermissions(admin)).toContain('member.manage')
    // ...but a plain MEMBER may not grant anything they lack.
    const memberGrantable = grantablePermissions(member)
    expect(memberGrantable).not.toContain('workflow.start')
    expect(memberGrantable).not.toContain('member.manage')
  })
})

describe('process instance archive', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('refuses to archive a running instance', async () => {
    const owner = await createContext('OWNER')
    const workflow = await createWorkflow(owner, { name: 'Running' })
    await saveWorkflowDraft(owner, {
      workflowId: workflow.id,
      name: 'Running',
      steps: [{ name: 'A' }],
    })
    await publishWorkflow(owner, workflow.id)
    const instance = await runInstance(owner, workflow.id)

    await expect(archiveInstance(owner, instance.id)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('archives a finished instance, hides it, and can restore it', async () => {
    const owner = await createContext('OWNER')
    const instance = await completedInstance(owner)

    expect((await listInstances(owner)).some((i) => i.id === instance.id)).toBe(true)

    await archiveInstance(owner, instance.id)
    expect((await listInstances(owner)).some((i) => i.id === instance.id)).toBe(false)
    expect((await listArchivedInstances(owner)).some((i) => i.id === instance.id)).toBe(true)

    // Archiving must not change the terminal state or destroy history.
    const after = await prisma.processInstance.findUniqueOrThrow({ where: { id: instance.id } })
    expect(after.status).toBe('COMPLETED')
    expect(after.archivedAt).not.toBeNull()

    await restoreInstance(owner, instance.id)
    expect((await listInstances(owner)).some((i) => i.id === instance.id)).toBe(true)
  })

  it('denies archiving without the workflow.delete permission', async () => {
    const owner = await createContext('OWNER')
    const instance = await completedInstance(owner)
    const member = await membershipFor(owner.organizationId, 'MEMBER')

    await expect(archiveInstance(member, instance.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('cannot archive an instance from another tenant', async () => {
    const ownerA = await createContext('OWNER')
    const ownerB = await createContext('OWNER')
    const instance = await completedInstance(ownerA)

    await expect(archiveInstance(ownerB, instance.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('rejects a second archive of the same instance (no partial state)', async () => {
    const owner = await createContext('OWNER')
    const instance = await completedInstance(owner)
    await archiveInstance(owner, instance.id)
    await expect(archiveInstance(owner, instance.id)).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('navigation access rules', () => {
  it('hides management areas from a plain MEMBER', () => {
    const member = { role: 'MEMBER' as const, permissions: permissionsFor('MEMBER') }
    expect(canAccess(member, 'workflows')).toBe(false)
    expect(canAccess(member, 'templates')).toBe(false)
    expect(canAccess(member, 'team')).toBe(false)
    expect(canAccess(member, 'analytics')).toBe(false)
    expect(canAccess(member, 'tasks')).toBe(true)
    expect(canAccess(member, 'pool')).toBe(true)
    expect(canAccess(member, 'dashboard')).toBe(true)
  })

  it('reveals the workflow area once a MEMBER may start processes', () => {
    const member = {
      role: 'MEMBER' as const,
      permissions: permissionsFor('MEMBER', ['workflow.start']),
    }
    expect(canAccess(member, 'workflows')).toBe(true)
    expect(canAccess(member, 'instances')).toBe(true)
  })

  it('shows every management area to an ADMIN', () => {
    const admin = { role: 'ADMIN' as const, permissions: permissionsFor('ADMIN') }
    expect(canAccess(admin, 'workflows')).toBe(true)
    expect(canAccess(admin, 'templates')).toBe(true)
    expect(canAccess(admin, 'team')).toBe(true)
    expect(canAccess(admin, 'analytics')).toBe(true)
    expect(canAccess(admin, 'archive')).toBe(true)
  })
})
