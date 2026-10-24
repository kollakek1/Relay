import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { createWorkflow, publishWorkflow, runInstance, saveWorkflowDraft } from '@/features/workflow/server/service'
import { claimTask } from '@/features/task/server/service'
import { cleanupDatabase, createContext, createTestUser, disconnect } from './helpers/db'

async function claimant(organizationId: string): Promise<Context> {
  const user = await createTestUser(`Claimant ${Math.random().toString(36).slice(2)}`)
  await prisma.membership.create({
    data: { organizationId, userId: user.id, role: 'MEMBER' },
  })
  return { userId: user.id, organizationId, role: 'MEMBER' }
}

describe('task pool atomicity', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('lets exactly one of many concurrent claimants win', async () => {
    const owner = await createContext('OWNER')
    const workflow = await createWorkflow(owner, { name: 'Race' })
    await saveWorkflowDraft(owner, {
      workflowId: workflow.id,
      name: 'Race',
      steps: [{ name: 'Only step' }],
    })
    await publishWorkflow(owner, workflow.id)
    const instance = await runInstance(owner, workflow.id)
    const [task] = await prisma.task.findMany({ where: { instanceId: instance.id } })

    const claimants = await Promise.all(
      Array.from({ length: 5 }, () => claimant(owner.organizationId))
    )

    const results = await Promise.allSettled(claimants.map((ctx) => claimTask(ctx, task.id)))

    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(4)
    for (const result of rejected) {
      expect(result.reason).toMatchObject({ code: 'CONFLICT' })
    }

    const final = await prisma.task.findUniqueOrThrow({ where: { id: task.id } })
    expect(final.status).toBe('CLAIMED')
    expect(final.claimVersion).toBe(1)
    expect(claimants.map((c) => c.userId)).toContain(final.assigneeId)
  })

  it('rejects a repeat claim of an already-claimed task', async () => {
    const owner = await createContext('OWNER')
    const workflow = await createWorkflow(owner, { name: 'Repeat' })
    await saveWorkflowDraft(owner, {
      workflowId: workflow.id,
      name: 'Repeat',
      steps: [{ name: 'Step' }],
    })
    await publishWorkflow(owner, workflow.id)
    const instance = await runInstance(owner, workflow.id)
    const [task] = await prisma.task.findMany({ where: { instanceId: instance.id } })

    await claimTask(owner, task.id)
    await expect(claimTask(owner, task.id)).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})
