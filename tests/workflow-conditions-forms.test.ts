import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import {
  createWorkflow,
  publishWorkflow,
  runInstance,
  saveWorkflowDraft,
} from '@/features/workflow/server/service'
import { claimTask, transitionTask } from '@/features/task/server/service'
import { cleanupDatabase, createContext, disconnect } from './helpers/db'

async function tasksOf(instanceId: string) {
  return prisma.task.findMany({ where: { instanceId }, orderBy: { stepOrder: 'asc' } })
}

async function completeTask(ctx: Context, taskId: string, formValues?: Record<string, unknown>) {
  await claimTask(ctx, taskId)
  await transitionTask(ctx, { taskId, to: 'IN_PROGRESS' })
  return transitionTask(ctx, { taskId, to: 'DONE', formValues })
}

describe('process forms', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('validates submitted form values server-side before completing', async () => {
    const ctx = await createContext('OWNER')
    const workflow = await createWorkflow(ctx, { name: 'Form flow' })
    await saveWorkflowDraft(ctx, {
      workflowId: workflow.id,
      name: 'Form flow',
      steps: [
        {
          name: 'Intake',
          fields: [
            {
              key: 'priority',
              label: 'Priority',
              type: 'select',
              required: true,
              options: ['low', 'high'],
            },
          ],
        },
      ],
    })
    await publishWorkflow(ctx, workflow.id)
    const instance = await runInstance(ctx, workflow.id)
    const [task] = await tasksOf(instance.id)

    await claimTask(ctx, task.id)
    await transitionTask(ctx, { taskId: task.id, to: 'IN_PROGRESS' })

    // Missing required field.
    await expect(
      transitionTask(ctx, { taskId: task.id, to: 'DONE', formValues: {} })
    ).rejects.toMatchObject({ code: 'VALIDATION' })

    // Invalid select option.
    await expect(
      transitionTask(ctx, { taskId: task.id, to: 'DONE', formValues: { priority: 'nope' } })
    ).rejects.toMatchObject({ code: 'VALIDATION' })

    // Valid submission is stored.
    const done = await transitionTask(ctx, {
      taskId: task.id,
      to: 'DONE',
      formValues: { priority: 'high' },
    })
    expect(done.formValues).toMatchObject({ priority: 'high' })
    expect(done.status).toBe('DONE')
  })
})

describe('conditional transitions', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('skips a step whose condition is false, and runs it when true', async () => {
    const ctx = await createContext('OWNER')
    const workflow = await createWorkflow(ctx, { name: 'Conditional' })
    await saveWorkflowDraft(ctx, {
      workflowId: workflow.id,
      name: 'Conditional',
      steps: [
        {
          name: 'Intake',
          fields: [
            { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'high'] },
          ],
        },
        { name: 'Escalate', condition: { field: 'priority', op: 'eq', value: 'high' } },
      ],
    })
    await publishWorkflow(ctx, workflow.id)

    // Branch A: priority = low → Escalate skipped, instance completes.
    const lowInstance = await runInstance(ctx, workflow.id)
    const lowTasks = await tasksOf(lowInstance.id)
    expect(lowTasks[1].status).toBe('BLOCKED')

    await completeTask(ctx, lowTasks[0].id, { priority: 'low' })

    const lowAfter = await tasksOf(lowInstance.id)
    expect(lowAfter[1].status).toBe('CANCELLED')
    expect(lowAfter[1].cancelReason).toMatch(/Skipped/)
    const lowInstanceRow = await prisma.processInstance.findUniqueOrThrow({
      where: { id: lowInstance.id },
    })
    expect(lowInstanceRow.status).toBe('COMPLETED')

    // Branch B: priority = high → Escalate activated, instance still running.
    const highInstance = await runInstance(ctx, workflow.id)
    const highTasks = await tasksOf(highInstance.id)
    await completeTask(ctx, highTasks[0].id, { priority: 'high' })

    const highAfter = await tasksOf(highInstance.id)
    expect(highAfter[1].status).toBe('PENDING')
    const highInstanceRow = await prisma.processInstance.findUniqueOrThrow({
      where: { id: highInstance.id },
    })
    expect(highInstanceRow.status).toBe('RUNNING')
  })

  it('rejects publishing a condition that references a field no earlier step collects', async () => {
    const ctx = await createContext('OWNER')
    const workflow = await createWorkflow(ctx, { name: 'Bad condition' })
    await saveWorkflowDraft(ctx, {
      workflowId: workflow.id,
      name: 'Bad condition',
      steps: [
        { name: 'A', condition: { field: 'later', op: 'eq', value: 'x' } },
        { name: 'B', fields: [{ key: 'later', label: 'Later', type: 'text' }] },
      ],
    })

    await expect(publishWorkflow(ctx, workflow.id)).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})
