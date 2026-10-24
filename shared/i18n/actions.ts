'use server'

import { cookies } from 'next/headers'
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from './config'

/**
 * Persists the user's language choice. Called from the language switcher; the
 * client then refreshes the current route so server components re-render in the
 * new locale. The cookie is a preference only — it never carries authority.
 */
export async function setLocaleAction(locale: string): Promise<{ ok: boolean }> {
  if (!isLocale(locale)) return { ok: false }
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
  })
  return { ok: true }
}
