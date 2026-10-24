import Link from 'next/link'
import { Button } from '../ui/button'
import { ThemeToggle } from '../theme-toggle'
import { BookIcon, CodeIcon, ImageIcon, ArrowRightIcon } from 'lucide-react'

const REPO_URL = 'https://github.com/kollakek1/Relay'

export const Header = () => {
  return (
    <header className="bg-card/20 fixed top-0 left-0 z-40 h-16 w-full border-b backdrop-blur-md max-lg:px-4">
      <div className="container mx-auto flex h-full items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-3xl font-bold">
            Relay
          </Link>
          <div className="flex gap-2 max-lg:hidden">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                Showcase <ImageIcon />
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`${REPO_URL}#readme`} target="_blank" rel="noreferrer">
                Learn <BookIcon />
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="secondary" asChild className="max-sm:hidden">
            <Link href={REPO_URL} target="_blank" rel="noreferrer">
              Github <CodeIcon />
            </Link>
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
