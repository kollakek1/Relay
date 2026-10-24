import { DocBlocks } from '@/shared/components/site/doc-blocks'
import { Section } from '@/shared/components/site/section'
import type { LegalPage as LegalPageContent } from '@/shared/i18n/content'

/**
 * Renders a legal draft. The draft notice is rendered prominently so an operator
 * cannot mistake the template for reviewed legal text.
 */
export function LegalPageView({ page, lastUpdatedLabel }: { page: LegalPageContent; lastUpdatedLabel: string }) {
  return (
    <Section className="mx-auto max-w-3xl">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{page.title}</h1>
        <p className="text-muted-foreground text-pretty">{page.lead}</p>
        <p className="text-muted-foreground text-xs">{lastUpdatedLabel}</p>
      </header>

      <aside className="border-destructive/40 bg-destructive/5 text-foreground mt-8 rounded-lg border-l-2 px-4 py-3 text-sm leading-relaxed">
        {page.draftNotice}
      </aside>

      <div className="mt-8">
        <DocBlocks blocks={page.blocks} />
      </div>
    </Section>
  )
}
