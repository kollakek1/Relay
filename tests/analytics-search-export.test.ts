import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { createWorkflow, publishWorkflow, runInstance, saveWorkflowDraft } from '@/features/workflow/server/service'
import { claimTask, transitionTask } from '@/features/task/server/service'
import { searchAll } from '@/features/search/server/service'
import { getAnalytics } from '@/features/analytics/server/service'
import { exportInstancesCsv, exportTasksCsv } from '@/features/export/server/service'
import { cleanupDatabase, createContext, disconnect } from './helpers/db'

async function seedRun(ctx: Context) {
  const workflow = await createWorkflow(ctx, { name: 'Onboarding' })
  await saveWorkflowDraft(ctx, {
    workflowId: workflow.id,
    name: 'Onboarding',
    steps: [{ name: 'Setup accounts' }, { name: 'Sign contract' }],
  })
  await publishWorkflow(ctx, workflow.id)
  const instance = await runInstance(ctx, workflow.id)
  const tasks = await prisma.task.findMany({
    where: { instanceId: instance.id },
    orderBy: { stepOrder: 'asc' },
  })
  await claimTask(ctx, tasks[0].id)
  await transitionTask(ctx, { taskId: tasks[0].id, to: 'IN_PROGRESS' })
  await transitionTask(ctx, { taskId: tasks[0].id, to: 'DONE' })
  return { workflow, instance, tasks }
}

describe('global search', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('finds entities in the active organization only', async () => {
    const ctxA = await createContext('OWNER')
    const ctxB = await createContext('OWNER')
    await seedRun(ctxA)

    const results = await searchAll(ctxA, 'Onboarding')
    expect(results.workflows.some((w) => w.name === 'Onboarding')).toBe(true)
    expect(results.instances.some((i) => i.workflowName === 'Onboarding')).toBe(true)

    const taskResults = await searchAll(ctxA, 'Setup')
    expect(taskResults.tasks.some((t) => t.name === 'Setup accounts')).toBe(true)

    // Tenant isolation: org B sees nothing from org A.
    const foreign = await searchAll(ctxB, 'Onboarding')
    expect(foreign.workflows).toHaveLength(0)
    expect(foreign.tasks).toHaveLength(0)
    expect(foreign.instances).toHaveLength(0)

    // Too-short queries return nothing.
    expect((await searchAll(ctxA, 'O')).workflows).toHaveLength(0)
  })
})

describe('analytics', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('computes overview metrics and bottlenecks from real data', async () => {
    const ctx = await createContext('OWNER')
    await seedRun(ctx)

    const analytics = await getAnalytics(ctx)
    expect(analytics.overview.instances.total).toBe(1)
    expect(analytics.overview.instances.running).toBe(1)
    expect(analytics.overview.tasks.total).toBe(2)
    expect(analytics.overview.tasks.done).toBe(1)
    expect(analytics.overview.tasks.open).toBe(1)
    expect(analytics.workflows).toHaveLength(1)
    expect(analytics.workflows[0].workflowName).toBe('Onboarding')
    // The completed step appears as a bottleneck sample.
    expect(analytics.bottlenecks.some((b) => b.samples > 0)).toBe(true)
  })

  it('keeps per-workflow overdue and bottlenecks isolated when step numbers collide', async () => {
    const ctx = await createContext('OWNER')

    const overdueFlow = await createWorkflow(ctx, { name: 'Overdue flow' })
    await saveWorkflowDraft(ctx, {
      workflowId: overdueFlow.id,
      name: 'Overdue flow',
      steps: [{ name: 'Shared step' }],
    })
    await publishWorkflow(ctx, overdueFlow.id)
    const overdueInstance = await runInstance(ctx, overdueFlow.id)

    const cleanFlow = await createWorkflow(ctx, { name: 'Clean flow' })
    await saveWorkflowDraft(ctx, {
      workflowId: cleanFlow.id,
      name: 'Clean flow',
      steps: [{ name: 'Shared step' }],
    })
    await publishWorkflow(ctx, cleanFlow.id)
    const cleanInstance = await runInstance(ctx, cleanFlow.id)

    const [overdueTask] = await prisma.task.findMany({ where: { instanceId: overdueInstance.id } })
    await prisma.task.update({
      where: { id: overdueTask.id },
      data: { dueAt: new Date(Date.now() - 60 * 60 * 1000) },
    })
    const [cleanTask] = await prisma.task.findMany({ where: { instanceId: cleanInstance.id } })
    await prisma.task.update({
      where: { id: cleanTask.id },
      data: { dueAt: new Date(Date.now() + 60 * 60 * 1000) },
    })

    const analytics = await getAnalytics(ctx)
    const overdue = analytics.workflows.find((w) => w.workflowId === overdueFlow.id)!
    const clean = analytics.workflows.find((w) => w.workflowId === cleanFlow.id)!

    // The overdue workflow's rate must not leak into the clean workflow.
    expect(overdue.overdueRate).toBe(1)
    expect(clean.overdueRate).toBe(0)

    // Both workflows have a step 1, but bottlenecks stay separated.
    const stepOneWorkflows = analytics.bottlenecks
      .filter((b) => b.stepOrder === 1)
      .map((b) => b.workflowId)
    expect(new Set(stepOneWorkflows).size).toBe(stepOneWorkflows.length)
    expect(stepOneWorkflows).toContain(overdueFlow.id)
    expect(stepOneWorkflows).toContain(cleanFlow.id)
  })
})

describe('CSV export', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('exports tasks and instances, scoped and bounded', async () => {
    const ctxA = await createContext('OWNER')
    const ctxB = await createContext('OWNER')
    await seedRun(ctxA)

    const tasks = await exportTasksCsv(ctxA)
    expect(tasks.csv.startsWith('id,name,status,priority,workflow')).toBe(true)
    expect(tasks.rows).toBe(2)
    expect(tasks.truncated).toBe(false)
    expect(tasks.csv).toContain('Setup accounts')

    const instances = await exportInstancesCsv(ctxA)
    expect(instances.rows).toBe(1)
    expect(instances.csv).toContain('Onboarding')

    // Tenant isolation — org B has only the header row.
    const foreign = await exportTasksCsv(ctxB)
    expect(foreign.rows).toBe(0)
    expect(foreign.csv).not.toContain('Setup accounts')
  })

  it('neutralises formula injection in attacker-controlled fields', async () => {
    const ctx = await createContext('OWNER')
    const workflow = await createWorkflow(ctx, { name: 'Injection' })
    await saveWorkflowDraft(ctx, {
      workflowId: workflow.id,
      name: 'Injection',
      steps: [{ name: 'Step' }],
    })
    await publishWorkflow(ctx, workflow.id)
    const instance = await runInstance(ctx, workflow.id)
    const [task] = await prisma.task.findMany({ where: { instanceId: instance.id } })
    await prisma.task.update({
      where: { id: task.id },
      data: { name: '=HYPERLINK("http://evil.example","click")' },
    })

    const result = await exportTasksCsv(ctx)
    // The dangerous value is prefixed with a spreadsheet text marker and quoted.
    expect(result.csv).toContain(`'=HYPERLINK`)
    expect(result.csv).not.toMatch(/(^|,)=HYPERLINK/)
  })
})
