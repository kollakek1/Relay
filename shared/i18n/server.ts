import { cookies, headers } from 'next/headers'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  matchAcceptLanguage,
  type Locale,
} from './config'
import { createT, type TFunction } from './translate'

/**
 * Server-side locale resolution.
 *
 * Order: persisted cookie → `Accept-Language` → default. Reading cookies makes
 * the pages that use translations render dynamically; that is the deliberate
 * trade-off for correct SSR (no hydration mismatch) and a correct `lang`
 * attribute.
 */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value
  if (isLocale(fromCookie)) return fromCookie

  const accept = (await headers()).get('accept-language')
  return matchAcceptLanguage(accept) ?? DEFAULT_LOCALE
}

export interface ServerTranslator {
  locale: Locale
  t: TFunction
}

/** Shorthand for server components: `const { t, locale } = await getTranslator()`. */
export async function getTranslator(): Promise<ServerTranslator> {
  const locale = await getLocale()
  return { locale, t: createT(locale) }
}
