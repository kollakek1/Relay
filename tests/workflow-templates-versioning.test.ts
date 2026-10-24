import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/shared/lib/prisma'
import {
  createWorkflow,
  getWorkflow,
  publishWorkflow,
  saveWorkflowDraft,
} from '@/features/workflow/server/service'
import {
  BUILT_IN_TEMPLATES,
  createWorkflowFromTemplate,
  listTemplates,
  saveWorkflowAsTemplate,
} from '@/features/workflow/server/templates'
import {
  compareVersions,
  createDraftFromVersion,
  diffSnapshots,
  listVersions,
} from '@/features/workflow/server/versioning'
import { normalizeSnapshot } from '@/features/workflow/server/engine'
import { cleanupDatabase, createContext, disconnect } from './helpers/db'

describe('version diff', () => {
  it('detects added, removed and changed steps', () => {
    const from = normalizeSnapshot([
      { order: 1, name: 'Draft', dueInDays: 2 },
      { order: 2, name: 'Review' },
      { order: 3, name: 'Old step' },
    ])
    const to = normalizeSnapshot([
      { order: 1, name: 'Draft', dueInDays: 5 },
      { order: 2, name: 'Review & approve', kind: 'APPROVAL', approvalMode: 'ANY' },
      { order: 3, name: 'Publish' },
    ])

    const diffs = diffSnapshots(from, to)
    expect(diffs[0].status).toBe('changed')
    expect(diffs[0].changes.join(' ')).toMatch(/Due/)
    expect(diffs[1].status).toBe('changed')
    expect(diffs[2].changes).toContain('Name: Old step → Publish')
  })
})

describe('templates', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('exposes built-in templates that create real editable drafts', async () => {
    const ctx = await createContext('OWNER')
    const { builtIn } = await listTemplates(ctx)
    expect(builtIn.length).toBeGreaterThanOrEqual(4)

    const created = await createWorkflowFromTemplate(ctx, { templateId: 'purchase-approval' })
    const workflow = await getWorkflow(ctx, created.id)

    expect(workflow.status).toBe('DRAFT')
    expect(workflow.steps.length).toBe(BUILT_IN_TEMPLATES.find((t) => t.id === 'purchase-approval')!.steps.length)
    // The approval step and its mode survived the copy.
    const approval = workflow.steps.find((step) => step.kind === 'APPROVAL')
    expect(approval?.approvalMode).toBe('ANY')
  })

  it('saves a workflow as a workspace template and reuses it', async () => {
    const ctx = await createContext('OWNER')
    const workflow = await createWorkflow(ctx, { name: 'Source flow' })
    await saveWorkflowDraft(ctx, {
      workflowId: workflow.id,
      name: 'Source flow',
      steps: [{ name: 'Step one' }, { name: 'Step two', kind: 'APPROVAL', approvalMode: 'ALL' }],
    })

    const template = await saveWorkflowAsTemplate(ctx, {
      workflowId: workflow.id,
      name: 'My template',
      description: 'Reusable',
    })

    const { saved } = await listTemplates(ctx)
    expect(saved.some((row) => row.id === template.id)).toBe(true)

    const copy = await createWorkflowFromTemplate(ctx, { templateId: template.id, name: 'Copy flow' })
    const copyWorkflow = await getWorkflow(ctx, copy.id)
    expect(copyWorkflow.name).toBe('Copy flow')
    expect(copyWorkflow.steps.map((step) => step.name)).toEqual(['Step one', 'Step two'])
  })

  it("does not expose another workspace's templates", async () => {
    const a = await createContext('OWNER')
    const b = await createContext('OWNER')
    const workflow = await createWorkflow(a, { name: 'Private flow' })
    await saveWorkflowDraft(a, { workflowId: workflow.id, name: 'Private flow', steps: [{ name: 'X' }] })
    const template = await saveWorkflowAsTemplate(a, { workflowId: workflow.id, name: 'Private template' })

    await expect(createWorkflowFromTemplate(b, { templateId: template.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect((await listTemplates(b)).saved).toHaveLength(0)
  })
})

describe('version history and restore', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('lists versions, compares them and restores a draft from an older version', async () => {
    const ctx = await createContext('OWNER')
    const workflow = await createWorkflow(ctx, { name: 'Versioned' })

    await saveWorkflowDraft(ctx, { workflowId: workflow.id, name: 'Versioned', steps: [{ name: 'Alpha' }] })
    await publishWorkflow(ctx, workflow.id)

    await saveWorkflowDraft(ctx, {
      workflowId: workflow.id,
      name: 'Versioned',
      steps: [{ name: 'Alpha' }, { name: 'Beta' }],
    })
    await publishWorkflow(ctx, workflow.id)

    const versions = await listVersions(ctx, workflow.id)
    expect(versions.map((version) => version.version)).toEqual([2, 1])

    const diff = await compareVersions(ctx, workflow.id, 1, 2)
    expect(diff.diffs.some((entry) => entry.status === 'added' && entry.name === 'Beta')).toBe(true)

    // Restore the draft from v1 → the extra step disappears from the draft but v2 remains.
    await createDraftFromVersion(ctx, workflow.id, 1)
    const afterRestore = await getWorkflow(ctx, workflow.id)
    expect(afterRestore.steps.map((step) => step.name)).toEqual(['Alpha'])
    expect(await prisma.workflowVersion.count({ where: { workflowId: workflow.id } })).toBe(2)
  })
})
