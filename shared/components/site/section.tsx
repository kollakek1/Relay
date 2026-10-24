import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/** Consistent vertical rhythm for public-site sections. */
export function Section({
  children,
  className,
  id,
  bordered = false,
  muted = false,
}: {
  children: ReactNode
  className?: string
  id?: string
  bordered?: boolean
  muted?: boolean
}) {
  return (
    <section
      id={id}
      className={cn(
        'py-16 lg:py-24',
        bordered && 'border-border border-y',
        muted && 'bg-muted/30',
        className
      )}
    >
      <div className="container mx-auto max-w-6xl px-4">{children}</div>
    </section>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  as: Heading = 'h2',
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  align?: 'center' | 'start'
  as?: 'h2' | 'h1'
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' ? 'mx-auto text-center' : 'text-left')}>
      {eyebrow ? (
        <p className="text-primary mb-3 text-sm font-medium tracking-wide uppercase">{eyebrow}</p>
      ) : null}
      <Heading className="text-2xl font-semibold tracking-tight text-balance lg:text-3xl">
        {title}
      </Heading>
      {subtitle ? <p className="text-muted-foreground mt-3 text-pretty">{subtitle}</p> : null}
    </div>
  )
}
