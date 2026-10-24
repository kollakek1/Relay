import { requireContext } from '@/shared/server/auth-context'
import { canManageWorkflows } from '@/shared/server/permissions'
import { listWorkflows } from '@/features/workflow/server/service'
import { PageHeader } from '@/shared/components/page-header'
import { WorkflowsView } from '@/features/workflow/components/workflows-view'

export default async function WorkflowsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const ctx = await requireContext()
  const { q } = await searchParams
  const workflows = await listWorkflows(ctx, q)

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader
        title="Workflows"
        description="Design, publish and version the processes your team runs."
      />
      <WorkflowsView
        workflows={workflows}
        canManage={canManageWorkflows(ctx.role)}
        initialQuery={q ?? ''}
      />
    </main>
  )
}
