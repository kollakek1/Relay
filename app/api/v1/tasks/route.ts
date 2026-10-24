import { apiJson, withApiKey } from '@/features/api/server/handler'
import { listTasks } from '@/features/task/server/service'
import { taskQuerySchema } from '@/features/task/schemas/taskSchema'

export const dynamic = 'force-dynamic'

/** GET /api/v1/tasks — paginated, filterable task list. */
export async function GET(request: Request) {
  return withApiKey(request, 'tasks:read', async ({ context }) => {
    const url = new URL(request.url)
    const parsed = taskQuerySchema.safeParse({
      search: url.searchParams.get('q') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      kind: url.searchParams.get('kind') ?? undefined,
      assignee: url.searchParams.get('assignee') ?? undefined,
      priority: url.searchParams.get('priority') ?? undefined,
      sort: url.searchParams.get('sort') ?? undefined,
      direction: url.searchParams.get('direction') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
    })
    if (!parsed.success) {
      return apiJson({ error: { code: 'validation', message: 'Invalid query parameters' } }, 422)
    }

    const page = await listTasks(context, parsed.data)

    return apiJson({
      data: page.items.map((task) => ({
        id: task.id,
        name: task.name,
        status: task.status,
        kind: task.kind,
        priority: task.priority,
        assignee: task.assignee?.name ?? null,
        dueAt: task.dueAt,
        workflow: task.instance?.workflow?.name ?? null,
        createdAt: task.createdAt,
      })),
      meta: { total: page.total, page: page.page, pageSize: page.pageSize },
    })
  })
}
