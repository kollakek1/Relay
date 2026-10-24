import { SiteFooter } from '@/shared/components/site/site-footer'
import { SiteHeader } from '@/shared/components/site/site-header'

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1 pt-16">{children}</main>
      <SiteFooter />
    </div>
  )
}
