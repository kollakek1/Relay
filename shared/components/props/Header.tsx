import Link from 'next/link'
import { Button } from '../ui/button'
import { ImageIcon, BookIcon, ArrowRightIcon, GithubIcon } from 'lucide-react'

export const Header = () => {
  return (
    <header className="bg-card/20 fixed top-0 left-0 h-16 w-full border-b backdrop-blur-md max-lg:px-4">
      <div className="container mx-auto flex h-full items-center justify-between">
        <div className="flex items-center gap-6">
          <p className="text-3xl font-bold">Relay</p>
          <div className="flex gap-2 max-lg:hidden">
            <Button variant={'ghost'} size={'sm'}>
              Showcase <ImageIcon />
            </Button>
            <Button variant={'ghost'} size={'sm'}>
              Learn <BookIcon />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={'secondary'}>
            Github <GithubIcon />
          </Button>
          <Button asChild>
            <Link href="/dashboard">
              Get Started <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
