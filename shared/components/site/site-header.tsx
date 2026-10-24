import Link from 'next/link'
import { BookIcon, CodeIcon, LayoutDashboardIcon, WorkflowIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { ThemeToggle } from '@/shared/components/theme-toggle'
import { LanguageSwitcher } from '@/shared/i18n/language-switcher'
import { getTranslator } from '@/shared/i18n/server'
import { REPO_URL } from '@/shared/components/site/links'
import { SiteNav, type SiteNavLink } from '@/shared/components/site/site-nav'

/** Public site header: brand, primary navigation, language and theme controls. */
export async function SiteHeader() {
  const { t } = await getTranslator()

  const links: SiteNavLink[] = [
    { href: '/features', label: t('nav.features') },
    { href: '/docs', label: t('nav.docs') },
    { href: '/api-reference', label: t('nav.apiReference') },
    { href: '/changelog', label: t('nav.changelog') },
  ]

  return (
    <header className="bg-background/80 fixed top-0 left-0 z-40 h-16 w-full border-b backdrop-blur-md">
      <div className="container mx-auto flex h-full items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="focus-visible:ring-ring flex items-center gap-2 rounded-md text-lg font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
          >
            <WorkflowIcon className="text-primary size-5" aria-hidden="true" />
            Relay
          </Link>
          <SiteNav
            links={links}
            menuLabel={t('common.openMenu')}
            closeLabel={t('common.close')}
          />
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher className="max-sm:hidden" />
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild className="max-lg:hidden">
            <Link href={REPO_URL} target="_blank" rel="noreferrer">
              <CodeIcon aria-hidden="true" />
              {t('nav.github')}
            </Link>
          </Button>
          <Button variant="secondary" size="sm" asChild className="max-sm:hidden">
            <Link href="/dashboard">
              <LayoutDashboardIcon aria-hidden="true" />
              {t('nav.dashboard')}
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard">
              <BookIcon aria-hidden="true" />
              {t('nav.getStarted')}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
