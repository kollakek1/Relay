'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/shared/i18n/config'
import { setLocaleAction } from '@/shared/i18n/actions'
import { useI18n } from '@/shared/i18n/provider'
import { cn } from '@/shared/lib/utils'

/**
 * Accessible language switcher. Persists the choice in a cookie through a
 * server action, then refreshes so server components render in the new locale.
 * Works on public pages, in the docs and inside the dashboard.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function select(next: Locale) {
    if (next === locale || pending) return
    startTransition(async () => {
      await setLocaleAction(next)
      document.documentElement.lang = next
      router.refresh()
    })
  }

  return (
    <div
      role="group"
      aria-label={t('language.switchTo')}
      className={cn(
        'border-border bg-muted/40 inline-flex items-center gap-0.5 rounded-lg border p-0.5',
        className
      )}
    >
      {LOCALES.map((code) => {
        const active = code === locale
        return (
          <button
            key={code}
            type="button"
            onClick={() => select(code)}
            aria-pressed={active}
            aria-label={LOCALE_LABELS[code]}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium transition-colors',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {code.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}
