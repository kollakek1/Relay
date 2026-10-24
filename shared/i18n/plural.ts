/**
 * Plural node shape shared by the message files and the translation runtime.
 *
 * Kept in its own module so `messages/en.ts` can annotate plural entries with
 * it without importing the runtime (which itself imports the messages).
 *
 * CLDR categories used by the supported locales:
 *  - `en`: `one`, `other`
 *  - `ru`: `one`, `few`, `many`, `other`
 * `other` is always required; the rest are optional and fall back to `other`.
 */
export interface PluralNode {
  one?: string
  few?: string
  many?: string
  other: string
}
