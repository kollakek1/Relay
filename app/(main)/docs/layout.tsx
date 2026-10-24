import Link from 'next/link'
import { LanguageSwitcher } from '@/shared/i18n/language-switcher'
import { getTranslator } from '@/shared/i18n/server'
import { DOC_SLUGS, type DocSlug } from '@/shared/i18n/content'
import type { MessageKey } from '@/shared/i18n/translate'

const DOC_LABEL_KEY: Record<DocSlug, MessageKey> = {
  quickstart: 'nav.quickstart',
  architecture: 'nav.architecture',
  security: 'nav.security',
  deployment: 'nav.deployment',
  configuration: 'nav.configuration',
  workflows: 'nav.workflows',
  automations: 'nav.automations',
  integrations: 'nav.integrations',
}

const DOC_LEAD_KEY: Record<DocSlug, MessageKey> = {
  quickstart: 'docs.quickstartLead',
  architecture: 'docs.architectureLead',
  security: 'docs.securityLead',
  deployment: 'docs.deploymentLead',
  configuration: 'docs.configurationLead',
  workflows: 'docs.workflowsLead',
  automations: 'docs.automationsLead',
  integrations: 'docs.integrationsLead',
}

/** Documentation shell: a persistent sidebar of every guide and its lead text. */
export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getTranslator()

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">{t('docs.subtitle')}</p>
        <LanguageSwitcher />
      </div>

      <div className="grid gap-10 lg:grid-cols-[16rem_1fr]">
        <nav aria-label={t('docs.sidebarHeading')} className="lg:sticky lg:top-24 lg:self-start">
          <ul className="space-y-1">
            <li>
              <Link
                href="/docs"
                className="hover:bg-accent block rounded-md px-3 py-2 text-sm font-medium"
              >
                {t('docs.backToDocs')}
              </Link>
            </li>
            {DOC_SLUGS.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/docs/${slug}`}
                  className="hover:bg-accent block rounded-md px-3 py-2 text-sm"
                >
                  <span className="block font-medium">{t(DOC_LABEL_KEY[slug])}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {t(DOC_LEAD_KEY[slug])}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
