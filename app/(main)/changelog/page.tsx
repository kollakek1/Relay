import type { Metadata } from 'next'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Section, SectionHeading } from '@/shared/components/site/section'
import { getTranslator } from '@/shared/i18n/server'
import { getContent } from '@/shared/i18n/content'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator()
  return { title: t('changelog.title'), description: t('changelog.subtitle') }
}

export default async function ChangelogPage() {
  const { t, locale } = await getTranslator()
  const releases = getContent(locale).changelog

  return (
    <Section>
      <SectionHeading as="h1" title={t('changelog.title')} subtitle={t('changelog.subtitle')} />

      {releases.length === 0 ? (
        <p className="text-muted-foreground mt-10 text-sm">{t('changelog.empty')}</p>
      ) : (
        <ol className="mx-auto mt-12 max-w-3xl space-y-6">
          {releases.map((release) => (
            <li key={release.version}>
              <Card className="bg-card/50">
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-semibold">{release.version}</h2>
                    {release.date ? (
                      <span className="text-muted-foreground text-sm">{release.date}</span>
                    ) : (
                      <Badge variant="outline">{t('changelog.unreleased')}</Badge>
                    )}
                  </div>
                  <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm">
                    {release.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}
