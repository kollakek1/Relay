import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRightIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  GitBranchIcon,
  GlobeIcon,
  InboxIcon,
  LanguagesIcon,
  MessagesSquareIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  WebhookIcon,
} from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Section, SectionHeading } from '@/shared/components/site/section'
import { getTranslator } from '@/shared/i18n/server'
import type { MessageKey } from '@/shared/i18n/translate'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator()
  return { title: t('featuresPage.title'), description: t('featuresPage.subtitle') }
}

export default async function FeaturesPage() {
  const { t } = await getTranslator()

  const features: Array<{ icon: React.ComponentType<{ className?: string }>; title: MessageKey; body: MessageKey }> = [
    { icon: GitBranchIcon, title: 'featuresPage.workflowTitle', body: 'featuresPage.workflowBody' },
    { icon: CheckCircle2Icon, title: 'featuresPage.versioningTitle', body: 'featuresPage.versioningBody' },
    { icon: InboxIcon, title: 'featuresPage.poolTitle', body: 'featuresPage.poolBody' },
    { icon: CheckCircle2Icon, title: 'featuresPage.approvalsTitle', body: 'featuresPage.approvalsBody' },
    { icon: MessagesSquareIcon, title: 'featuresPage.collaborationTitle', body: 'featuresPage.collaborationBody' },
    { icon: RefreshCwIcon, title: 'featuresPage.automationTitle', body: 'featuresPage.automationBody' },
    { icon: MessagesSquareIcon, title: 'featuresPage.notificationTitle', body: 'featuresPage.notificationBody' },
    { icon: BarChart3Icon, title: 'featuresPage.analyticsTitle', body: 'featuresPage.analyticsBody' },
    { icon: SearchIcon, title: 'featuresPage.searchTitle', body: 'featuresPage.searchBody' },
    { icon: WebhookIcon, title: 'featuresPage.apiTitle', body: 'featuresPage.apiBody' },
    { icon: ShieldCheckIcon, title: 'featuresPage.securityTitle', body: 'featuresPage.securityBody' },
    { icon: LanguagesIcon, title: 'featuresPage.i18nTitle', body: 'featuresPage.i18nBody' },
  ]

  return (
    <>
      <Section>
        <SectionHeading as="h1" title={t('featuresPage.title')} subtitle={t('featuresPage.subtitle')} />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="bg-card/50">
              <CardContent className="space-y-2">
                <h2 className="flex items-center gap-2 font-semibold">
                  <feature.icon className="text-primary size-4" aria-hidden="true" />
                  {t(feature.title)}
                </h2>
                <p className="text-muted-foreground text-sm text-pretty">{t(feature.body)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section bordered muted>
        <div className="flex flex-col items-center gap-5 text-center">
          <GlobeIcon className="text-primary size-8" aria-hidden="true" />
          <SectionHeading title={t('landing.finalCtaTitle')} subtitle={t('landing.finalCtaBody')} />
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/dashboard">
                {t('landing.finalCtaPrimary')} <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/docs/quickstart">{t('docs.quickstartTitle')}</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  )
}
