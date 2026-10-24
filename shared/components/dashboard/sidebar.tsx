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
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { Badge } from '@/shared/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import {
  BellIcon,
  BoxesIcon,
  CheckSquareIcon,
  ChevronUpIcon,
  HomeIcon,
  InboxIcon,
  LayoutTemplateIcon,
  LogOutIcon,
  SearchIcon,
  BarChart3Icon,
  SettingsIcon,
  UsersIcon,
  WorkflowIcon,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ThemeToggle } from '@/shared/components/theme-toggle'
import {
  WorkspaceSwitcher,
  type WorkspaceSummary,
} from '@/features/organization/components/workspace-switcher'
import { Loader2Icon } from 'lucide-react'

const navItems = [
  { title: 'Home', href: '/dashboard', icon: HomeIcon },
  { title: 'Search', href: '/dashboard/search', icon: SearchIcon },
  { title: 'Workflows', href: '/dashboard/workflows', icon: WorkflowIcon },
  { title: 'Templates', href: '/dashboard/templates', icon: LayoutTemplateIcon },
  { title: 'Tasks', href: '/dashboard/tasks', icon: CheckSquareIcon },
  { title: 'Task Pool', href: '/dashboard/pool', icon: InboxIcon },
  { title: 'Instances', href: '/dashboard/instances', icon: BoxesIcon },
  { title: 'Analytics', href: '/dashboard/analytics', icon: BarChart3Icon },
  { title: 'Team', href: '/dashboard/team', icon: UsersIcon },
  { title: 'Notifications', href: '/dashboard/notifications', icon: BellIcon },
  { title: 'Settings', href: '/dashboard/settings', icon: SettingsIcon },
]

export function DashboardSidebar({
  unreadCount = 0,
  workspaces = [],
  activeOrganizationId = null,
}: {
  unreadCount?: number
  workspaces?: WorkspaceSummary[]
  activeOrganizationId?: string | null
}) {
  const pathname = usePathname()
  const { user, logout, isLoading } = useAuth()
  const [confirmLogout, setConfirmLogout] = useState(false)

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`))

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center justify-between px-2 py-1">
            <Link href="/dashboard" className="text-2xl font-bold">
              Relay
            </Link>
            <ThemeToggle />
          </div>
          <WorkspaceSwitcher workspaces={workspaces} activeId={activeOrganizationId} />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        {item.href === '/dashboard/notifications' && unreadCount > 0 && (
                          <Badge className="ml-auto" variant="default">
                            {unreadCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="w-full" aria-label="Account menu">
                    <span className="flex-1 truncate text-left">{user?.name ?? 'Account'}</span>
                    <ChevronUpIcon className="h-4 w-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  className="w-[--radix-dropdown-menu-trigger-width]"
                >
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings">
                      <SettingsIcon />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={(event) => {
                      event.preventDefault()
                      setConfirmLogout(true)
                    }}
                  >
                    <LogOutIcon />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out of Relay?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to access your workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(isLoading && 'pointer-events-none opacity-80')}
              onClick={() => logout()}
            >
              {isLoading && <Loader2Icon className="animate-spin" />}
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
