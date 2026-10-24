import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DocBlocks } from '@/shared/components/site/doc-blocks'
import { getTranslator } from '@/shared/i18n/server'
import { DOC_SLUGS, getContent, isDocSlug } from '@/shared/i18n/content'

/**
 * Renders a documentation page from structured, locale-aware content. Invalid
 * slugs resolve to the standard 404 — no page is invented for an unknown path.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  if (!isDocSlug(slug)) return {}
  const { locale } = await getTranslator()
  const page = getContent(locale).docs[slug]
  return { title: page.title, description: page.lead }
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isDocSlug(slug)) notFound()

  const { locale, t } = await getTranslator()
  const page = getContent(locale).docs[slug]

  const related = DOC_SLUGS.filter((candidate) => candidate !== slug).slice(0, 3)

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance lg:text-3xl">
          {page.title}
        </h1>
        <p className="text-muted-foreground text-pretty">{page.lead}</p>
      </header>

      <DocBlocks blocks={page.blocks} />

      <footer className="border-border space-y-2 border-t pt-6">
        <p className="text-sm font-medium">{t('docs.related')}</p>
        <ul className="flex flex-wrap gap-3">
          {related.map((candidate) => (
            <li key={candidate}>
              <a
                href={`/docs/${candidate}`}
                className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
              >
                {getContent(locale).docs[candidate].title}
              </a>
            </li>
          ))}
        </ul>
      </footer>
    </article>
  )
}
