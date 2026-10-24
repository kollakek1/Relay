import Link from 'next/link'
import { ArrowRightIcon, SearchXIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { SiteFooter } from '@/shared/components/site/site-footer'
import { SiteHeader } from '@/shared/components/site/site-header'
import { getTranslator } from '@/shared/i18n/server'

/**
 * Application 404. Rendered with the public chrome so a broken link still lands
 * somewhere navigable. Dashboards and API routes are excluded from indexing
 * (see app/robots.ts).
 */
export default async function NotFound() {
  const { t } = await getTranslator()
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 pt-16">
        <div className="max-w-md space-y-5 text-center">
          <SearchXIcon className="text-muted-foreground mx-auto size-10" aria-hidden="true" />
          <h1 className="text-3xl font-semibold tracking-tight">{t('errors.notFoundTitle')}</h1>
          <p className="text-muted-foreground text-pretty">{t('errors.notFoundBody')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/">
                {t('errors.notFoundCta')} <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/docs">{t('nav.docs')}</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}