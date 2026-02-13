import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/shared/lib/auth'

import { SidebarProvider, SidebarTrigger } from '@/shared/components/ui/sidebar'
import { DashboardSidebar } from '@/shared/components/dashboard/sidebar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect('/dashboard/auth')
  }

  return (
    <>
      <SidebarProvider>
        <DashboardSidebar></DashboardSidebar>
        <SidebarTrigger className="mt-2 ml-2"></SidebarTrigger>
        {children}
      </SidebarProvider>
    </>
  )
}
