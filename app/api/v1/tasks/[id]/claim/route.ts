import { apiJson, withApiKey } from '@/features/api/server/handler'
import { claimTask } from '@/features/task/server/service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/v1/tasks/:id/claim — atomically claim a free task. Returns 409 when
 * another caller won the race.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return withApiKey(request, 'tasks:write', async ({ context }) => {
    await claimTask(context, id)
    return apiJson({ data: { id, status: 'CLAIMED' } })
  })
}
