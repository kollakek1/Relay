'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MenuIcon, XIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export interface SiteNavLink {
  href: string
  label: string
  external?: boolean
}

/**
 * Primary navigation. Renders inline on desktop and as an accessible disclosure
 * on mobile. Labels are translated on the server and passed in so this
 * component stays free of locale plumbing.
 */
export function SiteNav({
  links,
  menuLabel,
  closeLabel,
  className,
}: {
  links: SiteNavLink[]
  menuLabel: string
  closeLabel: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <nav aria-label={menuLabel} className={cn('hidden items-center gap-1 md:flex', className)}>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            target={link.external ? '_blank' : undefined}
            rel={link.external ? 'noreferrer' : undefined}
            className={cn(
              'hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors',
              !link.external && pathname === link.href
                ? 'text-foreground'
                : 'text-muted-foreground'
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        className="hover:bg-accent inline-flex size-9 items-center justify-center rounded-md md:hidden"
        aria-expanded={open}
        aria-controls="site-mobile-nav"
        aria-label={open ? closeLabel : menuLabel}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
      </button>

      {open ? (
        <div
          id="site-mobile-nav"
          className="bg-background absolute top-16 left-0 w-full border-b md:hidden"
        >
          <nav aria-label={menuLabel} className="container mx-auto flex flex-col gap-1 px-4 py-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noreferrer' : undefined}
                onClick={() => setOpen(false)}
                className="hover:bg-accent rounded-md px-3 py-2 text-sm font-medium"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </>
  )
}
