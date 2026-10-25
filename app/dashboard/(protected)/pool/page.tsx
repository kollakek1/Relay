import { requireAreaAccess } from '@/shared/server/auth-context'
import { listTaskPool } from '@/features/task/server/service'
import { PageHeader } from '@/shared/components/page-header'
import { EmptyState } from '@/shared/components/empty-state'
import { TaskFilters } from '@/features/task/components/task-filters'
import { TaskTable } from '@/features/task/components/task-table'
import { parseTaskQuery } from '@/features/task/server/query'
import { getTranslator } from '@/shared/i18n/server'
import { InboxIcon } from 'lucide-react'

export default async function TaskPoolPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const ctx = await requireAreaAccess('pool')
  const { t } = await getTranslator()
  const query = await parseTaskQuery(searchParams)
  const { items, total, page, pageSize } = await listTaskPool(ctx, query)

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader title={t('pages.poolTitle')} description={t('pages.poolDescription')} />
      <TaskFilters showAssignee={false} />
      {items.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title={t('pages.poolEmptyTitle')}
          description={t('pages.poolEmptyBody')}
        />
      ) : (
        <TaskTable tasks={items} total={total} page={page} pageSize={pageSize} showClaim />
      )}
    </main>
  )
}
