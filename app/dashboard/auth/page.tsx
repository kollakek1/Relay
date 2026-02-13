import { GridBackground } from '@/shared/components/decorative/gridBackground'
import { AuthCard } from '@/shared/components/auth/authCard'

const page = () => {
  return (
    <main className="flex h-screen items-center justify-center">
      <GridBackground />
      <AuthCard />
    </main>
  )
}

export default page
