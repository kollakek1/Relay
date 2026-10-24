import { requireContext } from '@/shared/server/auth-context'
import { listTaskPool } from '@/features/task/server/service'
import { PageHeader } from '@/shared/components/page-header'
import { EmptyState } from '@/shared/components/empty-state'
import { TaskFilters } from '@/features/task/components/task-filters'
import { TaskTable } from '@/features/task/components/task-table'
import { parseTaskQuery } from '@/features/task/server/query'
import { InboxIcon } from 'lucide-react'

export default async function TaskPoolPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const ctx = await requireContext()
  const query = await parseTaskQuery(searchParams)
  const { items, total, page, pageSize } = await listTaskPool(ctx, query)

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader
        title="Task pool"
        description="Claim unassigned tasks. Claims are atomic — no two people get the same task."
      />
      <TaskFilters showAssignee={false} />
      {items.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="The pool is empty"
          description="There are no available tasks to claim right now."
        />
      ) : (
        <TaskTable tasks={items} total={total} page={page} pageSize={pageSize} showClaim />
      )}
    </main>
  )
}
