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
  ArchiveIcon,
  BellIcon,
  BoxesIcon,
  CheckSquareIcon,
  ChevronUpIcon,
  HomeIcon,
  InboxIcon,
  LayoutTemplateIcon,
  LogOutIcon,
  SearchIcon,
  ShieldCheckIcon,
  BarChart3Icon,
  SettingsIcon,
  UsersIcon,
  WorkflowIcon,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import type { OrgRole } from '@/prisma/generated/prisma/enums'
import { canAccess, type AreaKey } from '@/shared/server/access'
import type { Permission } from '@/shared/server/permissions'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ThemeToggle } from '@/shared/components/theme-toggle'
import { LanguageSwitcher } from '@/shared/i18n/language-switcher'
import { useT } from '@/shared/i18n/provider'
import type { MessageKey } from '@/shared/i18n/translate'
import {
  WorkspaceSwitcher,
  type WorkspaceSummary,
} from '@/features/organization/components/workspace-switcher'
import { Loader2Icon } from 'lucide-react'

/**
 * Every entry declares the *area* it belongs to; visibility is derived from the
 * caller's permissions through the same rules the pages enforce, so navigation
 * and access control can never drift apart.
 */
const navItems: Array<{ title: MessageKey; href: string; icon: typeof HomeIcon; area: AreaKey }> = [
  { title: 'app.dashboard', href: '/dashboard', icon: HomeIcon, area: 'dashboard' },
  { title: 'app.search', href: '/dashboard/search', icon: SearchIcon, area: 'dashboard' },
  { title: 'app.workflows', href: '/dashboard/workflows', icon: WorkflowIcon, area: 'workflows' },
  { title: 'app.templates', href: '/dashboard/templates', icon: LayoutTemplateIcon, area: 'templates' },
  { title: 'app.instances', href: '/dashboard/instances', icon: BoxesIcon, area: 'instances' },
  { title: 'app.archive', href: '/dashboard/archive', icon: ArchiveIcon, area: 'archive' },
  { title: 'app.tasks', href: '/dashboard/tasks', icon: CheckSquareIcon, area: 'tasks' },
  { title: 'app.taskPool', href: '/dashboard/pool', icon: InboxIcon, area: 'pool' },
  { title: 'app.analytics', href: '/dashboard/analytics', icon: BarChart3Icon, area: 'analytics' },
  { title: 'app.access', href: '/dashboard/access', icon: ShieldCheckIcon, area: 'access' },
  { title: 'app.team', href: '/dashboard/team', icon: UsersIcon, area: 'team' },
  { title: 'app.notifications', href: '/dashboard/notifications', icon: BellIcon, area: 'notifications' },
  { title: 'app.settings', href: '/dashboard/settings', icon: SettingsIcon, area: 'settings' },
]

export function DashboardSidebar({
  unreadCount = 0,
  workspaces = [],
  activeOrganizationId = null,
  role,
  permissions = [],
}: {
  unreadCount?: number
  workspaces?: WorkspaceSummary[]
  activeOrganizationId?: string | null
  role?: OrgRole
  permissions?: readonly Permission[]
}) {
  const pathname = usePathname()
  const t = useT()
  const { user, logout, isLoading } = useAuth()
  const [confirmLogout, setConfirmLogout] = useState(false)

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`))

  const visibleNav = navItems.filter((item) =>
    canAccess({ role: role ?? 'MEMBER', permissions }, item.area)
  )

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center justify-between px-2 py-1">
            <Link href="/dashboard" className="text-2xl font-bold">
              Relay
            </Link>
            <div className="flex items-center gap-1">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
          <WorkspaceSwitcher workspaces={workspaces} activeId={activeOrganizationId} />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t('app.menu')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleNav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{t(item.title)}</span>
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
                  <SidebarMenuButton className="w-full" aria-label={t('app.accountMenu')}>
                    <span className="flex-1 truncate text-left">{user?.name ?? t('app.account')}</span>
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
                      {t('app.settings')}
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
                    {t('app.signOut')}
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
            <AlertDialogTitle>{t('app.logoutTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('app.logoutBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={cn(isLoading && 'pointer-events-none opacity-80')}
              onClick={() => logout()}
            >
              {isLoading && <Loader2Icon className="animate-spin" />}
              {t('app.logoutConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
