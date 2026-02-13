import { GridBackground } from '@/shared/components/decorative/gridBackground'
import { AuthCard } from '@/shared/components/auth/authCard'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/shared/lib/auth'

const page = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (session) {
    redirect('/dashboard')
  }

  return (
    <main className="flex h-screen items-center justify-center px-4">
      <GridBackground />
      <AuthCard />
    </main>
  )
}

export default page
