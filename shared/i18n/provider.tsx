'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { DEFAULT_LOCALE, type Locale } from './config'
import { createT, type TFunction } from './translate'

interface I18nValue {
  locale: Locale
  t: TFunction
}

const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  t: createT(DEFAULT_LOCALE),
})

/**
 * Provides the active locale to client components. The locale is resolved on
 * the server and passed as a prop, so the first client render matches the
 * server output (no hydration mismatch). Messages are bundled statically rather
 * than serialised into every RSC payload.
 */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nValue>(() => ({ locale, t: createT(locale) }), [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}

export function useT(): TFunction {
  return useContext(I18nContext).t
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale
}
