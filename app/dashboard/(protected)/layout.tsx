import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/shared/lib/auth'
import { getContext } from '@/shared/server/auth-context'
import { ensureOrganization } from '@/features/organization/server/bootstrap'
import { getUnreadCount } from '@/features/notification/server/service'

import { SidebarProvider, SidebarTrigger } from '@/shared/components/ui/sidebar'
import { DashboardSidebar } from '@/shared/components/dashboard/sidebar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect('/dashboard/auth')
  }

  // Guarantees the signed-in user always has a workspace to work in.
  await ensureOrganization(session.user.id)

  const ctx = await getContext()
  const unreadCount = ctx ? await getUnreadCount(ctx) : 0

  return (
    <SidebarProvider>
      <DashboardSidebar unreadCount={unreadCount} />
      <SidebarTrigger className="fixed mt-2 ml-2 lg:hidden" />
      {children}
    </SidebarProvider>
  )
}
