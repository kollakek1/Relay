import { apiJson, withApiKey } from '@/features/api/server/handler'
import { runInstance } from '@/features/workflow/server/service'

export const dynamic = 'force-dynamic'

/** POST /api/v1/workflows/:id/run — start a new process instance. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return withApiKey(request, 'instances:write', async ({ context }) => {
    const instance = await runInstance(context, id)
    return apiJson({ data: { id: instance.id, status: instance.status } }, 201)
  })
}
