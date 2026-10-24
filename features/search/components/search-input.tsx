'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/shared/components/ui/input'
import { useT } from '@/shared/i18n/provider'
import { Loader2Icon, SearchIcon } from 'lucide-react'

export function SearchInput({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const t = useT()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(initialQuery)

  useEffect(() => {
    const current = params.get('q') ?? ''
    if (query === current) return
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (query.trim()) next.set('q', query.trim())
      else next.delete('q')
      startTransition(() => router.push(`${pathname}?${next.toString()}`))
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return (
    <div className="relative w-full max-w-xl">
      <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        id="global-search"
        name="q"
        autoComplete="off"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('search.placeholder')}
        className="pl-9"
        aria-label={t('search.label')}
      />
      {isPending && (
        <Loader2Icon className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
      )}
    </div>
  )
}
