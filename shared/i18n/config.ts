/**
 * i18n configuration.
 *
 * Relay ships six locales and resolves the active one on the server from a
 * cookie, falling back to the browser's `Accept-Language`, then the default.
 * There is intentionally **no locale in the URL**: the app already has stable
 * routes used by auth redirects, invitation links and API keys, and adding a
 * `/ru/…` segment would break every existing link. The preference is stored in
 * a cookie and honoured on both public pages and the dashboard.
 */

export const LOCALES = ['en', 'ru', 'uk', 'de', 'be', 'kk'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

/** Short, unambiguous labels for the language switcher. */
export const LOCALE_CODES: Record<Locale, string> = {
  en: 'EN',
  ru: 'RU',
  uk: 'UK',
  de: 'DE',
  be: 'BE',
  kk: 'KK',
}

/** Cookie that persists the user's language choice. */
export const LOCALE_COOKIE = 'relay_locale'

/** Cookie lifetime (one year). */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Endonyms: every language is named in its own script. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
  uk: 'Українська',
  de: 'Deutsch',
  be: 'Беларуская',
  kk: 'Қазақша',
}

/** `Intl` locale used for dates and numbers (differs from the app `Locale` tag). */
export const LOCALE_BCP47: Record<Locale, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  uk: 'uk-UA',
  de: 'de-DE',
  be: 'be-BY',
  kk: 'kk-KZ',
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/**
 * Picks the best locale from an `Accept-Language` header, honouring quality
 * values (`q=`). Returns `null` when nothing matches.
 */
export function matchAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null

  const candidates = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params
        .map((param) => param.trim())
        .find((param) => param.startsWith('q='))
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.slice(2)) : 1 }
    })
    .filter((candidate) => candidate.tag.length > 0 && Number.isFinite(candidate.q))
    .sort((a, b) => b.q - a.q)

  for (const { tag } of candidates) {
    const base = tag.split('-')[0]
    if (isLocale(base)) return base
  }
  return null
}
