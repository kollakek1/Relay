import { en, type Messages } from './messages/en'
import { ru } from './messages/ru'
import { uk } from './messages/uk'
import { de } from './messages/de'
import { be } from './messages/be'
import { kk } from './messages/kk'
import type { Locale } from './config'
import type { PluralNode } from './plural'

export type { PluralNode }

/**
 * Translation runtime.
 *
 * Messages are plain objects. The key type (`MessageKey`) is derived from the
 * English source, so `t('nav.dockets')` is a compile error. Plural nodes are
 * objects with CLDR plural categories (`one` / `other`) and are selected with
 * `Intl.PluralRules` when the call passes a numeric `count`.
 */

export const MESSAGES: Record<Locale, Messages> = { en, ru, uk, de, be, kk }

export type DeepKeys<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends string
        ? K
        : T[K] extends PluralNode
          ? K
          : `${K}.${DeepKeys<T[K]>}`
    }[keyof T & string]
  : never

export type MessageKey = DeepKeys<Messages>
export type TVars = Record<string, string | number>
export type TFunction = (key: MessageKey, vars?: TVars) => string

function lookup(messages: Messages, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[part]
    return undefined
  }, messages)
}

function interpolate(template: string, vars?: TVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  )
}

function resolvePlural(node: Record<string, string>, category: string, fallback: string): string {
  return node[category] ?? node.other ?? fallback
}

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale] ?? MESSAGES.en
}

/** Builds a translation function bound to `locale`. Pure — safe on client and server. */
export function createT(locale: Locale): TFunction {
  const messages = getMessages(locale)
  const plural = new Intl.PluralRules(locale)

  return (key: MessageKey, vars?: TVars): string => {
    const node = lookup(messages, key)

    if (typeof node === 'string') return interpolate(node, vars)

    if (node && typeof node === 'object') {
      const count = typeof vars?.count === 'number' ? vars.count : undefined
      const category = count === undefined ? 'other' : plural.select(count)
      return interpolate(resolvePlural(node as Record<string, string>, category, key), vars)
    }

    // Typed keys make this unreachable, but a defensive fallback keeps the UI
    // readable if a key is ever referenced dynamically.
    const fallback = lookup(MESSAGES.en, key)
    if (typeof fallback === 'string') return interpolate(fallback, vars)
    if (fallback && typeof fallback === 'object') {
      return interpolate(resolvePlural(fallback as Record<string, string>, 'other', key), vars)
    }
    return key
  }
}

/** Flattens a message tree to dot-paths (used by the completeness check). */
export function flattenKeys(messages: Messages): string[] {
  const keys: string[] = []
  const walk = (node: unknown, prefix: string) => {
    if (typeof node === 'string') {
      keys.push(prefix)
      return
    }
    if (node && typeof node === 'object') {
      for (const [child, value] of Object.entries(node as Record<string, unknown>)) {
        walk(value, prefix ? `${prefix}.${child}` : child)
      }
    }
  }
  walk(messages, '')
  return keys.sort()
}

/**
 * Lists keys whose value is identical to the English source in `locale`
 * (candidate untranslated, excluding proper nouns like `Relay`).
 */
export function findUntranslatedKeys(locale: Locale = 'ru'): string[] {
  const english = new Map<string, string>()
  const collect = (node: unknown, prefix: string) => {
    if (typeof node === 'string') {
      english.set(prefix, node)
      return
    }
    if (node && typeof node === 'object') {
      const record = node as Record<string, unknown>
      if (typeof record.other === 'string' && ('one' in record || 'few' in record || 'many' in record)) {
        english.set(prefix, JSON.stringify(record))
        return
      }
      for (const [child, value] of Object.entries(record)) {
        collect(value, prefix ? `${prefix}.${child}` : child)
      }
    }
  }
  collect(en, '')

  const identical: string[] = []
  const walk = (node: unknown, prefix: string) => {
    if (typeof node === 'string') {
      if (english.get(prefix) === node) identical.push(prefix)
      return
    }
    if (node && typeof node === 'object') {
      const record = node as Record<string, unknown>
      if (typeof record.other === 'string' && ('one' in record || 'few' in record || 'many' in record)) {
        if (english.get(prefix) === JSON.stringify(record)) identical.push(prefix)
        return
      }
      for (const [child, value] of Object.entries(record)) {
        walk(value, prefix ? `${prefix}.${child}` : child)
      }
    }
  }
  walk(MESSAGES[locale] ?? en, '')
  return identical
}
