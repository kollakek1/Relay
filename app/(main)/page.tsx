import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRightIcon,
  AppWindowIcon,
  BookIcon,
  BoxesIcon,
  CheckCircle2Icon,
  FileCodeIcon,
  GitBranchIcon,
  HandIcon,
  InboxIcon,
  KeyRoundIcon,
  LockIcon,
  RefreshCwIcon,
  ServerIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WebhookIcon,
} from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { GridBackground } from '@/shared/components/decorative/gridBackground'
import { CodeBlock } from '@/shared/components/site/code-block'
import { Faq } from '@/shared/components/site/faq'
import { ProductPreview } from '@/shared/components/site/product-preview'
import { Section, SectionHeading } from '@/shared/components/site/section'
import { REPO_URL } from '@/shared/components/site/links'
import { getTranslator } from '@/shared/i18n/server'
import { getContent } from '@/shared/i18n/content'
import type { ListItem } from '@/shared/i18n/content'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator()
  return { description: t('meta.description') }
}

function ItemGrid({
  items,
  icons,
}: {
  items: ListItem[]
  icons: Array<React.ComponentType<{ className?: string }>>
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => {
        const Icon = icons[index % icons.length]
        return (
          <Card key={item.title} className="bg-card/50">
            <CardContent className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <Icon className="text-primary size-4" aria-hidden="true" />
                {item.title}
              </h3>
              <p className="text-muted-foreground text-sm text-pretty">{item.body}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export default async function Home() {
  const { t, locale } = await getTranslator()
  const content = getContent(locale).landing

  const featureItems: ListItem[] = [
    { title: t('featuresPage.workflowTitle'), body: t('featuresPage.workflowBody') },
    { title: t('featuresPage.versioningTitle'), body: t('featuresPage.versioningBody') },
    { title: t('featuresPage.poolTitle'), body: t('featuresPage.poolBody') },
    { title: t('featuresPage.approvalsTitle'), body: t('featuresPage.approvalsBody') },
    { title: t('featuresPage.automationTitle'), body: t('featuresPage.automationBody') },
    { title: t('featuresPage.analyticsTitle'), body: t('featuresPage.analyticsBody') },
  ]

  const faqItems = [
    { question: t('landingFaq.q1'), answer: t('landingFaq.a1') },
    { question: t('landingFaq.q2'), answer: t('landingFaq.a2') },
    { question: t('landingFaq.q3'), answer: t('landingFaq.a3') },
    { question: t('landingFaq.q4'), answer: t('landingFaq.a4') },
    { question: t('landingFaq.q5'), answer: t('landingFaq.a5') },
    { question: t('landingFaq.q6'), answer: t('landingFaq.a6') },
  ]

  return (
    <>
      {/* 1–5. Hero with both CTAs and the product preview */}
      <section className="relative overflow-hidden">
        <GridBackground />
        <div className="container mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center lg:py-28">
          <Badge variant="outline" className="gap-1">
            <SparklesIcon aria-hidden="true" />
            {t('landing.heroBadge')}
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-balance lg:text-6xl">
            {t('landing.heroTitle')}
          </h1>
          <p className="text-muted-foreground text-lg text-pretty lg:text-xl">
            {t('landing.heroSubtitle')}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="xl" asChild>
              <Link href="/dashboard">
                {t('landing.primaryCta')} <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
            <Button size="xl" variant="secondary" asChild>
              <Link href="/docs">
                {t('landing.secondaryCta')} <BookIcon aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">{t('landing.heroFootNote')}</p>
        </div>

        <div className="container mx-auto px-4 pb-16">
          <ProductPreview />
        </div>
      </section>

      {/* 6. Key features */}
      <Section bordered>
        <SectionHeading
          eyebrow={t('landing.trustHeading')}
          title={t('landing.featuresHeading')}
          subtitle={t('landing.featuresSubtitle')}
        />
        <div className="mt-10">
          <ItemGrid
            items={featureItems}
            icons={[GitBranchIcon, BoxesIcon, InboxIcon, CheckCircle2Icon, RefreshCwIcon, AppWindowIcon]}
          />
        </div>
        <p className="text-muted-foreground mx-auto mt-8 max-w-2xl text-center text-sm text-pretty">
          {t('landing.trustBody')}
        </p>
      </Section>

      {/* 7. Workflow lifecycle */}
      <Section>
        <SectionHeading title={t('landing.lifecycleHeading')} subtitle={t('landing.lifecycleSubtitle')} />
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {content.lifecycle.map((step, index) => (
            <li key={step.title} className="space-y-2">
              <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-sm font-semibold">
                {index + 1}
              </div>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="text-muted-foreground text-sm text-pretty">{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* 8. Tasks, approvals and automation */}
      <Section bordered>
        <SectionHeading title={t('landing.workHeading')} subtitle={t('landing.workSubtitle')} />
        <div className="mt-10">
          <ItemGrid items={content.work} icons={[InboxIcon, CheckCircle2Icon, RefreshCwIcon]} />
        </div>
      </Section>

      {/* 9. API and integrations */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              align="start"
              title={t('landing.apiHeading')}
              subtitle={t('landing.apiSubtitle')}
            />
            <ul className="mt-6 space-y-4">
              {content.api.map((item, index) => {
                const Icon = [KeyRoundIcon, FileCodeIcon, WebhookIcon][index] ?? KeyRoundIcon
                return (
                  <li key={item.title} className="flex gap-3">
                    <Icon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-muted-foreground text-sm text-pretty">{item.body}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="mt-6">
              <Button variant="outline" asChild>
                <Link href="/api-reference">
                  {t('nav.apiReference')} <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
          <CodeBlock
            language="bash"
            copyLabel={t('common.copy')}
            copiedLabel={t('common.copied')}
            failedLabel={t('common.copyFailed')}
            code={`# compile against the live API
curl https://your-host/api/v1/tasks?status=PENDING \\
  -H "Authorization: Bearer $RELAY_API_KEY"

curl -X POST https://your-host/api/v1/workflows/$WF/run \\
  -H "Authorization: Bearer $RELAY_API_KEY"`}
          />
        </div>
      </Section>

      {/* 10. Security and self-hosting */}
      <Section bordered muted>
        <SectionHeading title={t('landing.securityHeading')} subtitle={t('landing.securitySubtitle')} />
        <div className="mt-10">
          <ItemGrid
            items={content.security}
            icons={[LockIcon, ShieldCheckIcon, ServerIcon]}
          />
        </div>
        <p className="text-muted-foreground mx-auto mt-8 max-w-2xl text-center text-sm">
          {t('footer.noTracking')}
        </p>
      </Section>

      {/* 11. Developers */}
      <Section>
        <SectionHeading title={t('landing.devHeading')} subtitle={t('landing.devSubtitle')} />
        <div className="mt-10">
          <ItemGrid items={content.developers} icons={[BoxesIcon, CheckCircle2Icon, FileCodeIcon]} />
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="outline" asChild>
            <Link href={REPO_URL} target="_blank" rel="noreferrer">
              {t('footer.sourceCode')}
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/docs/architecture">
              {t('nav.architecture')} <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </Section>

      {/* 12. Quickstart */}
      <Section bordered>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              align="start"
              title={t('landing.quickstartHeading')}
              subtitle={t('landing.quickstartSubtitle')}
            />
            <ol className="mt-6 space-y-4">
              {content.quickstartSteps.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="bg-secondary text-secondary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium">{step.title}</p>
                    <p className="text-muted-foreground text-sm">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6">
              <Button asChild>
                <Link href="/docs/quickstart">
                  {t('docs.quickstartTitle')} <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
          <CodeBlock
            language="bash"
            copyLabel={t('common.copy')}
            copiedLabel={t('common.copied')}
            failedLabel={t('common.copyFailed')}
            code={content.quickstartCode}
          />
        </div>
      </Section>

      {/* 13. FAQ */}
      <Section>
        <SectionHeading title={t('landing.faqHeading')} />
        <div className="mt-10">
          <Faq items={faqItems} />
        </div>
      </Section>

      {/* 14. Final CTA */}
      <Section bordered muted className="text-center">
        <SectionHeading title={t('landing.finalCtaTitle')} subtitle={t('landing.finalCtaBody')} />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="xl" asChild>
            <Link href="/dashboard">
              {t('landing.finalCtaPrimary')} <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
          <Button size="xl" variant="outline" asChild>
            <Link href={REPO_URL} target="_blank" rel="noreferrer">
              {t('landing.finalCtaSecondary')} <HandIcon aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </Section>
    </>
  )
}
