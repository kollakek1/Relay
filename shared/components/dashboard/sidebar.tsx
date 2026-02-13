'use client'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import {
  Home,
  FileText,
  Users,
  CheckSquare,
  Settings,
  LogOut,
  ChevronUp,
  Workflow,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/shared/lib/utils'
import { useAuth } from '@/features/auth/hooks/useAuth'

const navItems = [
  {
    title: 'Главная',
    href: '/dashboard',
    icon: Home,
  },
  {
    title: 'Процессы',
    href: '/dashboard/processes',
    icon: Workflow,
  },
  {
    title: 'Задачи',
    href: '/dashboard/tasks',
    icon: CheckSquare,
  },
  {
    title: 'Документы',
    href: '/dashboard/documents',
    icon: FileText,
  },
  {
    title: 'Команда',
    href: '/dashboard/team',
    icon: Users,
  },
  {
    title: 'Настройки',
    href: '/dashboard/settings',
    icon: Settings,
  },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const { user } = useAuth()

  return (
    <Sidebar>
      <SidebarHeader>
        <p className="text-4xl font-bold">Relay</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Меню</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild className={cn(isActive && 'bg-accent')}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="w-full">
                  <span className="flex-1 text-left">{user?.name}</span>
                  <ChevronUp className="h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-dropdown-menu-trigger-width]">
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Настройки
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
