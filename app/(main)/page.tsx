import Link from 'next/link'
import { Button } from '@/shared/components/ui/button'
import { GridBackground } from '@/shared/components/decorative/gridBackground'
import { ArrowRightIcon, BookIcon } from 'lucide-react'

export default function Home() {
  return (
    <main className="container mx-auto flex h-screen items-center justify-center px-4">
      <GridBackground />
      <div className="flex flex-col items-center gap-6 text-center lg:gap-12">
        <h1 className="text-3xl font-bold lg:text-6xl">
          Orchestrate <span className="dark:text-shadow-primary text-shadow-lg">Your Business</span>{' '}
          on Your Terms.
        </h1>
        <h2 className="text-muted-foreground lg:w-2xl lg:text-xl">
          Relay is the open-source BPM system that combines developer freedom with{' '}
          <span className="text-primary font-medium">enterprise-grade</span> workflow automation.
        </h2>
        <div className="flex gap-4">
          <Button size={'xl'} variant={'secondary'} asChild>
            <Link href={'/learn'}>
              Learn <BookIcon />
            </Link>
          </Button>
          <Button size={'xl'} asChild>
            <Link href="/dashboard">
              Get Started <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
