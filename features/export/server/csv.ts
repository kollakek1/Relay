/**
 * CSV serialisation helpers.
 *
 * Two problems must be solved at once:
 *
 *  1. **Structural escaping** — commas, quotes and CR/LF must be quoted so the
 *     row cannot break apart.
 *  2. **Formula injection** — spreadsheet software evaluates a cell whose
 *     (leading-whitespace-stripped) content begins with `=`, `+`, `-` or `@`.
 *     Task names, comments and emails are attacker-controlled, so such cells
 *     are prefixed with `'` (a spreadsheet text marker) unless they are a
 *     genuine number or ISO date, which are safe and must be preserved
 *     (for example `-42` must stay a number, not become `'-42`).
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g
const NUMERIC = /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

/** True when a string would be interpreted as a formula by a spreadsheet. */
export function isFormulaInjection(text: string): boolean {
  const meaningful = text.replace(/^[\s\u0009\u000d\u000a]+/, '')
  if (!/^[=+\-@]/.test(meaningful)) return false
  const trimmed = text.trim()
  return !NUMERIC.test(trimmed) && !ISO_DATE.test(trimmed)
}

/**
 * Renders a single value as a safe CSV cell: control characters are removed,
 * formula-leading values are neutralised, and the field is quoted when it
 * contains a separator, quote or line break.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''

  let text: string
  if (value instanceof Date) {
    text = value.toISOString()
  } else if (typeof value === 'number') {
    text = Number.isFinite(value) ? String(value) : ''
  } else if (typeof value === 'boolean') {
    text = value ? 'true' : 'false'
  } else {
    text = String(value)
  }

  text = text.replace(CONTROL_CHARS, '')

  const prefix = isFormulaInjection(text) ? "'" : ''
  const escaped = text.replace(/"/g, '""')
  const needsQuoting = prefix.length > 0 || /[",\n\r]/.test(text)

  return needsQuoting ? `"${prefix}${escaped}"` : `${prefix}${escaped}`
}

/** Serialises a header row plus data rows to RFC 4180 CSV (CRLF separated). */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))]
  return lines.join('\r\n')
}
