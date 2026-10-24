import { logger } from './logger'

/**
 * Application error used across the server service layer.
 *
 * Services throw `AppError`; server actions translate it into a structured
 * `ActionResult`. Keeping the code machine-readable lets the UI branch on
 * `UNAUTHORIZED` / `FORBIDDEN` / `CONFLICT` / `NOT_FOUND` without string
 * matching.
 */
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'RATE_LIMITED'

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 422,
  RATE_LIMITED: 429,
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = STATUS[code]
  }
}

export const unauthorized = (message = 'Authentication required') =>
  new AppError('UNAUTHORIZED', message)
export const forbidden = (message = 'You do not have access to this resource') =>
  new AppError('FORBIDDEN', message)
export const notFound = (message = 'Resource not found') => new AppError('NOT_FOUND', message)
export const conflict = (message = 'The resource was modified by someone else') =>
  new AppError('CONFLICT', message)
export const invalid = (message = 'Invalid input') => new AppError('VALIDATION', message)
export const rateLimited = (message = 'Too many requests. Please try again shortly.') =>
  new AppError('RATE_LIMITED', message)

/** Structured result returned from every server action. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ErrorCode }

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function fail(error: unknown): ActionResult<never> {
  if (error instanceof AppError) {
    return { ok: false, error: error.message, code: error.code }
  }
  logger.error('unexpected_server_error', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack?.split('\n').slice(0, 4).join('\n') : undefined,
  })
  return { ok: false, error: 'Something went wrong. Please try again.', code: 'VALIDATION' }
}
