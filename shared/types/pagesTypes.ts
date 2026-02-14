import { LucideProps } from 'lucide-react'

export interface Page {
  name: string
  href: string
}

export interface SideBarPage extends Page {
  icon: LucideProps
}
