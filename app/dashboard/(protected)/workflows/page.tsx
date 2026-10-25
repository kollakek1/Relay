import { requireAreaAccess } from '@/shared/server/auth-context'
import { can } from '@/shared/server/permissions'
import { listWorkflows } from '@/features/workflow/server/service'
import { PageHeader } from '@/shared/components/page-header'
import { WorkflowsView } from '@/features/workflow/components/workflows-view'
import { getTranslator } from '@/shared/i18n/server'

export default async function WorkflowsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>
}) {
  const ctx = await requireAreaAccess('workflows')
  const { t } = await getTranslator()
  const { q, archived } = await searchParams
  const includeArchived = archived === '1'
  const workflows = await listWorkflows(ctx, q, { includeArchived })

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader
        title={t('pages.workflowsTitle')}
        description={t('pages.workflowsDescription')}
      />
      <WorkflowsView
        workflows={workflows}
        canManage={can(ctx, 'workflow.create')}
        initialQuery={q ?? ''}
        includeArchived={includeArchived}
      />
    </main>
  )
}
