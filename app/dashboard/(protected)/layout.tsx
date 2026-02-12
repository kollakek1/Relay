import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/shared/lib/auth'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect('/dashboard/auth')
  }

  return <>{children}</>
}
