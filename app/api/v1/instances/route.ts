import { apiJson, withApiKey } from '@/features/api/server/handler'
import { listInstances } from '@/features/workflow/server/service'

export const dynamic = 'force-dynamic'

/** GET /api/v1/instances — recent process runs. */
export async function GET(request: Request) {
  return withApiKey(request, 'instances:read', async ({ context }) => {
    const instances = await listInstances(context)
    return apiJson({
      data: instances.map((instance) => ({
        id: instance.id,
        workflow: instance.workflow.name,
        version: instance.version.version,
        status: instance.status,
        tasks: instance._count.tasks,
        completedTasks: instance.tasks.length,
        startedBy: instance.startedBy.name,
        startedAt: instance.startedAt,
      })),
    })
  })
}
