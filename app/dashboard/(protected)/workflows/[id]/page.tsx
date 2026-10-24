import { notFound } from 'next/navigation'
import { requireContext } from '@/shared/server/auth-context'
import { canManageWorkflows, canWorkOnTasks } from '@/shared/server/permissions'
import { getWorkflow } from '@/features/workflow/server/service'
import { PageHeader } from '@/shared/components/page-header'
import { WorkflowBuilder } from '@/features/workflow/components/workflow-builder'
import { VersionHistory } from '@/features/workflow/components/version-history'
import { compareVersions, listVersions } from '@/features/workflow/server/versioning'
import type { ConditionOp, FormFieldType } from '@/features/workflow/server/engine'
import { AppError } from '@/shared/server/errors'

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireContext()
  const { id } = await params

  let workflow
  try {
    workflow = await getWorkflow(ctx, id)
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound()
    throw error
  }

  const versions = await listVersions(ctx, id)
  const diff =
    versions.length >= 2
      ? await compareVersions(ctx, id, versions[1].version, versions[0].version)
      : null

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader
        title={workflow.name}
        description="Edit the draft, publish versions and start process instances."
      />
      <WorkflowBuilder
        workflow={{
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          status: workflow.status,
          steps: workflow.steps.map((step) => ({
            name: step.name,
            description: step.description ?? '',
            assigneeRole: step.assigneeRole,
            dueInDays: step.dueInDays,
            kind: step.kind,
            approvalMode: step.approvalMode,
            fields: (Array.isArray(step.fields) ? step.fields : []).map((field) => {
              const f = field as {
                key?: string
                label?: string
                type?: string
                required?: boolean
                options?: string[]
              }
              return {
                key: f.key ?? '',
                label: f.label ?? '',
                type: (f.type ?? 'text') as FormFieldType,
                required: Boolean(f.required),
                optionsText: (f.options ?? []).join(', '),
              }
            }),
            condition: (() => {
              const c = step.condition as { field?: string; op?: ConditionOp; value?: unknown } | null
              return {
                field: c?.field ?? '',
                op: (c?.op ?? 'eq') as ConditionOp,
                valueText: c?.value === undefined || c?.value === null ? '' : String(c.value),
              }
            })(),
          })),
          versions: workflow.versions.map((version) => ({
            id: version.id,
            version: version.version,
            publishedAt: version.publishedAt,
          })),
          instanceCount: workflow._count.instances,
        }}
        canManage={canManageWorkflows(ctx.role)}
        canRun={canWorkOnTasks(ctx.role)}
      />

      <VersionHistory
        workflowId={workflow.id}
        canManage={canManageWorkflows(ctx.role)}
        versions={versions.map((version) => ({
          id: version.id,
          version: version.version,
          publishedAt: version.publishedAt,
          publishedByName: version.publishedBy.name,
          instances: version._count.instances,
        }))}
        diff={diff ? { from: diff.from, to: diff.to, diffs: diff.diffs } : null}
      />
    </main>
  )
}
