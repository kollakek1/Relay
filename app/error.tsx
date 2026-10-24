'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangleIcon, RefreshCwIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useT } from '@/shared/i18n/provider'

/**
 * Route-level error boundary. Surfaces a safe, translated message and a retry
 * action; the underlying error is logged to the console for operators. It never
 * renders internal error details to the user.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useT()

  useEffect(() => {
    console.error('[relay] render error', error.digest ?? error.message)
  }, [error])

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="max-w-md space-y-5 text-center">
        <AlertTriangleIcon className="text-destructive mx-auto size-10" aria-hidden="true" />
        <h1 className="text-2xl font-semibold tracking-tight">{t('errors.genericTitle')}</h1>
        <p className="text-muted-foreground text-pretty">{t('errors.genericBody')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>
            <RefreshCwIcon aria-hidden="true" />
            {t('common.retry')}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">{t('errors.genericCta')}</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}