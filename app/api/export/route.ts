import { getContext } from '@/shared/server/auth-context'
import { AppError } from '@/shared/server/errors'
import { logger } from '@/shared/server/logger'
import { RATE_LIMITS, rateLimit } from '@/shared/server/rate-limit'
import { exportInstancesCsv, exportTasksCsv } from '@/features/export/server/service'

/**
 * CSV export endpoint. Permission- and rate-limit-protected; tenant-scoped and
 * bounded (see MAX_EXPORT_ROWS). Runs as a normal request — no background job.
 */
export async function GET(request: Request) {
  try {
    const ctx = await getContext()
    if (!ctx) return new Response('Unauthorized', { status: 401 })

    await rateLimit('export', ctx.userId, RATE_LIMITS.export)

    const url = new URL(request.url)
    const kind = url.searchParams.get('kind') === 'instances' ? 'instances' : 'tasks'

    const result =
      kind === 'instances'
        ? await exportInstancesCsv(ctx)
        : await exportTasksCsv(ctx, {
            status: url.searchParams.get('status') ?? undefined,
            search: url.searchParams.get('q') ?? undefined,
          })

    logger.info('export_completed', { kind, rows: result.rows, truncated: result.truncated })

    return new Response(result.csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="relay-${kind}.csv"`,
        'x-export-rows': String(result.rows),
        'x-export-truncated': String(result.truncated),
      },
    })
  } catch (error) {
    if (error instanceof AppError) {
      return new Response(error.message, { status: error.status })
    }
    logger.error('export_failed', {
      message: error instanceof Error ? error.message : String(error),
    })
    return new Response('Export failed', { status: 500 })
  }
}
