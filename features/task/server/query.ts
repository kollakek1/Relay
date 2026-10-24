import { taskQuerySchema, type TaskQuery } from '../schemas/taskSchema'

/**
 * Parses URL search params into a validated task query. Unknown / invalid
 * values are ignored so a hand-crafted URL cannot break the list endpoint.
 */
export async function parseTaskQuery(
  searchParams: Promise<Record<string, string | undefined>>
): Promise<TaskQuery> {
  const raw = await searchParams
  const parsed = taskQuerySchema.safeParse({
    search: raw.q,
    status: raw.status,
    assignee: raw.assignee,
    priority: raw.priority,
    sort: raw.sort,
    direction: raw.direction,
    page: raw.page,
  })
  return parsed.success ? parsed.data : {}
}
