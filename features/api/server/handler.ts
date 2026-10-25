import type { Context } from '@/shared/server/context'
import { AppError } from '@/shared/server/errors'
import { logger } from '@/shared/server/logger'
import { RATE_LIMITS, rateLimit } from '@/shared/server/rate-limit'
import { authenticateApiKey, hasScope, type ApiKeyPrincipal, type ApiScope } from './keys'

export function apiJson(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

export function apiError(code: string, message: string, status: number): Response {
  return apiJson({ error: { code, message } }, status)
}

export interface ApiHandlerArgs {
  principal: ApiKeyPrincipal
  context: Context
  request: Request
}

/**
 * Wraps a public API route: authenticates the bearer key, enforces the required
 * scope and a per-key rate limit, then runs the handler with a tenant-scoped
 * `Context`. Errors are always returned in a uniform envelope.
 */
export async function withApiKey(
  request: Request,
  scope: ApiScope,
  handler: (args: ApiHandlerArgs) => Promise<Response>
): Promise<Response> {
  try {
    const header = request.headers.get('authorization')
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
    if (!token) return apiError('unauthorized', 'Missing API key', 401)

    const principal = await authenticateApiKey(token)
    if (!principal) return apiError('unauthorized', 'Invalid or revoked API key', 401)

    if (!hasScope(principal, scope)) {
      return apiError('forbidden', `This key is missing the "${scope}" scope`, 403)
    }

    await rateLimit(`api:${principal.apiKeyId}`, principal.apiKeyId, RATE_LIMITS.apiRequest)

    const context: Context = {
      userId: principal.userId,
      organizationId: principal.organizationId,
      role: principal.role,
      permissions: principal.permissions,
    }

    return await handler({ principal, context, request })
  } catch (error) {
    if (error instanceof AppError) {
      return apiError(error.code.toLowerCase(), error.message, error.status)
    }
    logger.error('api_error', {
      message: error instanceof Error ? error.message : String(error),
    })
    return apiError('internal', 'Unexpected error', 500)
  }
}
