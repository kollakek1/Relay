'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/components/ui/sidebar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { useAction } from '@/shared/hooks/useAction'
import { initials } from '@/shared/lib/format'
import {
  bootstrapOrganizationAction,
  switchOrganizationAction,
} from '@/features/organization/actions'
import { CheckIcon, ChevronsUpDownIcon, Loader2Icon, PlusIcon } from 'lucide-react'
import { useT } from '@/shared/i18n/provider'

export interface WorkspaceSummary {
  id: string
  name: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
}

export function WorkspaceSwitcher({
  workspaces,
  activeId,
}: {
  workspaces: WorkspaceSummary[]
  activeId: string | null
}) {
  const router = useRouter()
  const t = useT()
  const { isPending, run } = useAction()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')

  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0]

  const switchTo = (id: string) => {
    if (id === (active?.id ?? activeId) || isPending) return
    run(() => switchOrganizationAction({ organizationId: id }), {
      onSuccess: () => router.refresh(),
    })
  }

  const createWorkspace = () => {
    run(() => bootstrapOrganizationAction({ name }), {
      success: t('workspace.created'),
      onSuccess: () => {
        setCreateOpen(false)
        setName('')
        router.refresh()
      },
    })
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" aria-label={t('workspace.switch')}>
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-xs font-semibold">
                  {initials(active?.name)}
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">{active?.name ?? t('workspace.none')}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {active?.role ? t(`status.${active.role}`) : '—'}
                  </span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
            >
              <DropdownMenuLabel>{t('workspace.heading')}</DropdownMenuLabel>
              {workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onSelect={() => switchTo(workspace.id)}
                  disabled={isPending}
                >
                  <span className="truncate">{workspace.name}</span>
                  {workspace.id === active?.id && <CheckIcon className="ml-auto size-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  setCreateOpen(true)
                }}
              >
                <PlusIcon />
                {t('workspace.create')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('workspace.createTitle')}</DialogTitle>
            <DialogDescription>
              {t('workspace.createBody')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="workspace-name">{t('workspace.name')}</Label>
            <Input
              id="workspace-name"
              value={name}
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
              placeholder={t('workspace.namePlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={createWorkspace} disabled={isPending || name.trim().length < 2}>
              {isPending && <Loader2Icon className="animate-spin" />}
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
