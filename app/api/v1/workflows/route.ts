import { apiJson, withApiKey } from '@/features/api/server/handler'
import { listWorkflows } from '@/features/workflow/server/service'

export const dynamic = 'force-dynamic'

/** GET /api/v1/workflows — list workflows for the key's organization. */
export async function GET(request: Request) {
  return withApiKey(request, 'workflows:read', async ({ context }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('q') ?? undefined
    const workflows = await listWorkflows(context, search)

    return apiJson({
      data: workflows.map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        steps: workflow._count.steps,
        versions: workflow._count.versions,
        instances: workflow._count.instances,
        updatedAt: workflow.updatedAt,
      })),
    })
  })
}
