'use client'

import { useState } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

/**
 * Copyable code block. Renders server-provided code with a client-side copy
 * button; the copy action has an accessible label that flips to a confirmation.
 */
export function CodeBlock({
  code,
  language,
  copyLabel,
  copiedLabel,
  failedLabel,
  className,
}: {
  code: string
  language?: string
  copyLabel: string
  copiedLabel: string
  failedLabel: string
  className?: string
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setState('copied')
    } catch {
      setState('failed')
    }
    setTimeout(() => setState('idle'), 2000)
  }

  const label = state === 'copied' ? copiedLabel : state === 'failed' ? failedLabel : copyLabel

  return (
    <figure className={cn('relative', className)}>
      <div className="border-border bg-muted/40 overflow-hidden rounded-lg border">
        {language ? (
          <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-xs">
            <span>{language}</span>
          </div>
        ) : null}
        <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={label}
        title={label}
        className="border-border bg-background/90 hover:bg-accent focus-visible:ring-ring absolute top-1.5 right-1.5 inline-flex size-8 items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        {state === 'copied' ? (
          <CheckIcon className="text-primary size-4" aria-hidden="true" />
        ) : (
          <CopyIcon className="size-4" aria-hidden="true" />
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {state === 'idle' ? '' : label}
      </span>
    </figure>
  )
}
