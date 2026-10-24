import { requireContext } from '@/shared/server/auth-context'
import { listTasks } from '@/features/task/server/service'
import { parseTaskQuery } from '@/features/task/server/query'
import { PageHeader } from '@/shared/components/page-header'
import { EmptyState } from '@/shared/components/empty-state'
import { Button } from '@/shared/components/ui/button'
import { TaskFilters } from '@/features/task/components/task-filters'
import { TaskTable } from '@/features/task/components/task-table'
import { getTranslator } from '@/shared/i18n/server'
import { DownloadIcon, ListChecksIcon } from 'lucide-react'

type SearchParams = Promise<Record<string, string | undefined>>

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireContext()
  const { t } = await getTranslator()
  const query = await parseTaskQuery(searchParams)
  const { items, total, page, pageSize } = await listTasks(ctx, query)

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader
        title={t('pages.tasksTitle')}
        description={t('pages.tasksDescription')}
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export?kind=tasks" download>
              <DownloadIcon />
              {t('pages.exportCsv')}
            </a>
          </Button>
        }
      />
      <TaskFilters />
      {items.length === 0 ? (
        <EmptyState
          icon={ListChecksIcon}
          title={t('pages.tasksEmptyTitle')}
          description={t('pages.tasksEmptyBody')}
        />
      ) : (
        <TaskTable tasks={items} total={total} page={page} pageSize={pageSize} />
      )}
    </main>
  )
}
