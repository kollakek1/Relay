import Link from 'next/link'
import { CodeIcon } from 'lucide-react'
import { LanguageSwitcher } from '@/shared/i18n/language-switcher'
import { getTranslator } from '@/shared/i18n/server'
import { REPO_URL } from '@/shared/components/site/links'

/** Public site footer with grouped, working links only. */
export async function SiteFooter() {
  const { t } = await getTranslator()
  const year = new Date().getFullYear()

  const groups: Array<{ heading: string; links: Array<{ href: string; label: string; external?: boolean }> }> = [
    {
      heading: t('footer.productHeading'),
      links: [
        { href: '/features', label: t('nav.features') },
        { href: '/docs/quickstart', label: t('nav.quickstart') },
        { href: '/changelog', label: t('nav.changelog') },
      ],
    },
    {
      heading: t('footer.docsHeading'),
      links: [
        { href: '/docs/architecture', label: t('nav.architecture') },
        { href: '/docs/security', label: t('nav.security') },
        { href: '/docs/deployment', label: t('nav.deployment') },
        { href: '/docs/configuration', label: t('nav.configuration') },
      ],
    },
    {
      heading: t('footer.projectHeading'),
      links: [
        { href: REPO_URL, label: t('footer.sourceCode'), external: true },
        { href: '/api-reference', label: t('nav.apiReference') },
        { href: '/docs/integrations', label: t('nav.integrations') },
      ],
    },
    {
      heading: t('footer.legalHeading'),
      links: [
        { href: '/privacy', label: t('nav.privacy') },
        { href: '/terms', label: t('nav.terms') },
      ],
    },
  ]

  return (
    <footer className="border-border border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="space-y-3">
            <p className="text-lg font-semibold tracking-tight">Relay</p>
            <p className="text-muted-foreground max-w-xs text-sm">{t('footer.tagline')}</p>
            <LanguageSwitcher />
          </div>

          {groups.map((group) => (
            <nav key={group.heading} aria-label={group.heading} className="space-y-3">
              <h2 className="text-sm font-semibold">{group.heading}</h2>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noreferrer' : undefined}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="text-muted-foreground mt-10 flex flex-col gap-3 border-t pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} Relay · {t('footer.license')}
          </p>
          <div className="flex items-center gap-4">
            <span>{t('footer.builtWith')}</span>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              <CodeIcon className="size-4" aria-hidden="true" />
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
