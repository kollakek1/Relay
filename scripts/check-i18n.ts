/**
 * Verifies RU/EN translation completeness.
 *
 * TypeScript already enforces that `ru` has exactly the keys of `en` (both are
 * `Messages`). This script adds the checks the type system cannot express:
 *   - key sets are identical at runtime (guards against `as any` escapes),
 *   - no value is empty or whitespace-only,
 *   - plural nodes expose a valid `other` category,
 *   - reports keys whose Russian value is identical to English (usually a
 *     missed translation; technical terms are allowed and listed for review).
 *
 * Exits non-zero on any hard failure so CI blocks the change.
 */
import { LOCALES, DEFAULT_LOCALE, type Locale } from '../shared/i18n/config'
import { MESSAGES, findUntranslatedKeys } from '../shared/i18n/translate'

type Node = string | { [key: string]: Node }

/** A plural node is treated as one key (its CLDR categories are not keys). */
function isPluralNode(node: unknown): node is Record<string, string> {
  if (!node || typeof node !== 'object') return false
  const record = node as Record<string, unknown>
  return typeof record.other === 'string' && ('one' in record || 'few' in record || 'many' in record)
}

function collect(node: unknown, prefix: string, out: Map<string, string>): void {
  if (typeof node === 'string') {
    out.set(prefix, node)
    return
  }
  if (node && typeof node === 'object') {
    if (isPluralNode(node)) {
      out.set(prefix, JSON.stringify(node))
      return
    }
    for (const [child, value] of Object.entries(node as Record<string, Node>)) {
      collect(value, prefix ? `${prefix}.${child}` : child, out)
    }
  }
}

function flatten(locale: Locale): Map<string, string> {
  const map = new Map<string, string>()
  collect(MESSAGES[locale], '', map)
  return map
}

let failed = false
function fail(message: string): void {
  failed = true
  console.error(`x ${message}`)
}

const reference = flatten(DEFAULT_LOCALE)
const referenceKeys = [...reference.keys()].sort()

console.log(`Reference locale: ${DEFAULT_LOCALE} (${referenceKeys.length} keys)`)

for (const locale of LOCALES) {
  const messages = flatten(locale)
  const keys = [...messages.keys()].sort()

  const missing = referenceKeys.filter((key) => !messages.has(key))
  const extra = keys.filter((key) => !reference.has(key))

  if (missing.length > 0) fail(`[${locale}] missing keys: ${missing.join(', ')}`)
  if (extra.length > 0) fail(`[${locale}] unknown keys: ${extra.join(', ')}`)

  for (const [key, value] of messages) {
    if (value.trim().length === 0) fail(`[${locale}] empty value for "${key}"`)
  }

  console.log(`  ${locale}: ${keys.length} keys`)
}

// Plural sanity: every plural node must carry an `other` form.
function checkPlurals(locale: Locale, node: unknown, prefix: string): void {
  if (!node || typeof node !== 'object') return
  const record = node as Record<string, unknown>
  const isPlural = 'one' in record || 'other' in record
  if (isPlural && typeof record.other !== 'string') {
    fail(`[${locale}] plural node "${prefix}" is missing the required "other" form`)
  }
  for (const [child, value] of Object.entries(record)) {
    checkPlurals(locale, value, prefix ? `${prefix}.${child}` : child)
  }
}
for (const locale of LOCALES) checkPlurals(locale, MESSAGES[locale], '')

const untranslated = findUntranslatedKeys()
if (untranslated.length > 0) {
  console.warn(
    `warn ${untranslated.length} value(s) are identical in en and ru (verify these are intentional):`
  )
  for (const key of untranslated) console.warn(`    ${key}`)
}

if (failed) {
  console.error('\ni18n check failed.')
  process.exit(1)
}
console.log('\ni18n check passed.')
