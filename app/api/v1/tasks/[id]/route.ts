import { apiJson, withApiKey } from '@/features/api/server/handler'
import { getTask } from '@/features/task/server/service'

export const dynamic = 'force-dynamic'

/** GET /api/v1/tasks/:id — a single task with its process context. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return withApiKey(request, 'tasks:read', async ({ context }) => {
    const task = await getTask(context, id)
    return apiJson({
      data: {
        id: task.id,
        name: task.name,
        description: task.description,
        status: task.status,
        kind: task.kind,
        priority: task.priority,
        decision: task.decision,
        formValues: task.formValues,
        dueAt: task.dueAt,
        assignee: task.assignee ? { id: task.assignee.id, name: task.assignee.name } : null,
        instance: { id: task.instance.id, status: task.instance.status },
        workflow: task.instance.workflow?.name ?? null,
        createdAt: task.createdAt,
      },
    })
  })
}
