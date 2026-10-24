import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { getTranslator } from '@/shared/i18n/server'
import { DOC_SLUGS, getContent } from '@/shared/i18n/content'
import type { MessageKey } from '@/shared/i18n/translate'

const TITLE_KEY: Record<(typeof DOC_SLUGS)[number], MessageKey> = {
  quickstart: 'docs.quickstartTitle',
  architecture: 'docs.architectureTitle',
  security: 'docs.securityTitle',
  deployment: 'docs.deploymentTitle',
  configuration: 'docs.configurationTitle',
  workflows: 'docs.workflowsTitle',
  automations: 'docs.automationsTitle',
  integrations: 'docs.integrationsTitle',
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator()
  return { title: t('docs.title'), description: t('docs.subtitle') }
}

export default async function DocsIndexPage() {
  const { t, locale } = await getTranslator()
  const content = getContent(locale)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('docs.title')}</h1>
      <p className="text-muted-foreground leading-relaxed">{t('docs.subtitle')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {DOC_SLUGS.map((slug) => (
          <Card key={slug} className="bg-card/50 transition-colors hover:bg-accent/40">
            <CardContent>
              <Link href={`/docs/${slug}`} className="focus-visible:ring-ring block rounded-md outline-none focus-visible:ring-2">
                <h2 className="flex items-center gap-1 font-semibold">
                  {t(TITLE_KEY[slug])}
                  <ArrowRightIcon className="size-4" aria-hidden="true" />
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">{content.docs[slug].lead}</p>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
