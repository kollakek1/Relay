import type { Metadata } from 'next'
import { LegalPageView } from '@/shared/components/site/legal-page'
import { getTranslator } from '@/shared/i18n/server'
import { getContent } from '@/shared/i18n/content'

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getTranslator()
  return { title: t('legal.privacyTitle'), description: getContent(locale).legal.privacy.lead }
}

export default async function PrivacyPage() {
  const { t, locale } = await getTranslator()
  const page = getContent(locale).legal.privacy
  return <LegalPageView page={page} lastUpdatedLabel={`${t('legal.lastUpdated')}: 2026-10-24`} />
}