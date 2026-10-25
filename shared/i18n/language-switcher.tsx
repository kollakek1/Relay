'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon, GlobeIcon, Loader2Icon } from 'lucide-react'
import {
  LOCALE_CODES,
  LOCALE_LABELS,
  LOCALES,
  type Locale,
} from '@/shared/i18n/config'
import { setLocaleAction } from '@/shared/i18n/actions'
import { useI18n } from '@/shared/i18n/provider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'

/**
 * Language switcher — a compact dropdown listing every supported language by
 * its endonym plus a short code. Persists the choice in a cookie through a
 * server action, then refreshes so server components re-render in the new
 * locale without a full reload. The active language is announced to assistive
 * technology and marked with a check.
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
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('language.switchTo')}
        className={cn(
          'border-border bg-muted/40 text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
          className
        )}
      >
        {pending ? (
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
        ) : (
          <GlobeIcon className="size-4" aria-hidden />
        )}
        <span aria-hidden>{LOCALE_CODES[locale]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>{t('language.label')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LOCALES.map((code) => {
          const active = code === locale
          return (
            <DropdownMenuItem
              key={code}
              onSelect={() => select(code)}
              aria-current={active ? 'true' : undefined}
              className="gap-2"
            >
              <CheckIcon
                className={cn('size-4 shrink-0', active ? 'opacity-100' : 'opacity-0')}
                aria-hidden
              />
              <span className="flex-1">{LOCALE_LABELS[code]}</span>
              <span className="text-muted-foreground text-xs">{LOCALE_CODES[code]}</span>
              {active && <span className="sr-only">{t('language.current')}</span>}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
