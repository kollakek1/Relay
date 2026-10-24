import { ChevronDownIcon } from 'lucide-react'

export interface FaqItem {
  question: string
  answer: string
}

/**
 * FAQ built on native `<details>`/`<summary>`, so it is keyboard-operable and
 * works without JavaScript.
 */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="mx-auto max-w-3xl divide-y rounded-xl border">
      {items.map((item) => (
        <details key={item.question} className="group px-5 py-4">
          <summary className="focus-visible:ring-ring flex cursor-pointer list-none items-center justify-between gap-4 rounded-md font-medium focus-visible:ring-2 focus-visible:outline-none">
            {item.question}
            <ChevronDownIcon
              className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <p className="text-muted-foreground mt-3 text-sm text-pretty">{item.answer}</p>
        </details>
      ))}
    </div>
  )
}
