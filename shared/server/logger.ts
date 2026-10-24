/**
 * Minimal structured logger. Emits single-line JSON so serverless platforms can
 * index it, and redacts anything that looks like a secret. Never pass raw
 * request bodies or credentials here.
 */
type Level = 'debug' | 'info' | 'warn' | 'error'

const SENSITIVE_KEY = /(pass(word)?|secret|token|authorization|cookie|api[-_]?key|apikey)/i
const MAX_DEPTH = 4

function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[deep]'
  if (value === null || typeof value !== 'object') return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1))

  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(val, depth + 1)
  }
  return out
}

function emit(level: Level, event: string, data?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(data ? (redact(data) as Record<string, unknown>) : {}),
  }
  const line = JSON.stringify(payload)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (event: string, data?: Record<string, unknown>) => emit('debug', event, data),
  info: (event: string, data?: Record<string, unknown>) => emit('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => emit('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => emit('error', event, data),
}

/** Correlation id for a request/operation (best-effort, no async context needed). */
export function newRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}
