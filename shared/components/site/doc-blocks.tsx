import { CodeBlock } from '@/shared/components/site/code-block'
import { getTranslator } from '@/shared/i18n/server'
import type { DocBlock } from '@/shared/i18n/content'

/**
 * Renders structured documentation blocks server-side. Because the content is
 * data rather than free-form HTML, it is automatically locale-aware and there
 * is no `dangerouslySetInnerHTML` anywhere in the docs.
 */
export async function DocBlocks({ blocks }: { blocks: DocBlock[] }) {
  const { t } = await getTranslator()

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'h2':
            return (
              <h2
                key={index}
                className="scroll-mt-24 pt-2 text-xl font-semibold tracking-tight text-balance"
              >
                {block.text}
              </h2>
            )
          case 'h3':
            return (
              <h3 key={index} className="text-base font-semibold text-balance">
                {block.text}
              </h3>
            )
          case 'p':
            return (
              <p key={index} className="text-muted-foreground leading-relaxed text-pretty">
                {block.text}
              </p>
            )
          case 'ul':
            return (
              <ul key={index} className="text-muted-foreground list-disc space-y-2 pl-5">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            )
          case 'code':
            return (
              <CodeBlock
                key={index}
                code={block.code}
                language={block.language}
                copyLabel={t('common.copy')}
                copiedLabel={t('common.copied')}
                failedLabel={t('common.copyFailed')}
              />
            )
          case 'note':
            return (
              <aside
                key={index}
                className="border-primary/40 bg-primary/5 rounded-lg border-l-2 px-4 py-3 text-sm leading-relaxed"
              >
                {block.text}
              </aside>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
