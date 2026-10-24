'use client'

import { useMemo, useState } from 'react'
import type { OrgRole } from '@/prisma/generated/prisma/enums'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { EmptyState } from '@/shared/components/empty-state'
import { Loader2Icon, MoreVerticalIcon, SearchIcon, Trash2Icon, UserCogIcon, UsersIcon } from 'lucide-react'
import {
  removeMemberAction,
  transferOwnershipAction,
  updateMemberRoleAction,
} from '@/features/organization/actions'
import { useAction } from '@/shared/hooks/useAction'
import { useT } from '@/shared/i18n/provider'
import type { MessageKey } from '@/shared/i18n/translate'
import { formatDate, initials } from '@/shared/lib/format'

export interface TeamMember {
  id: string
  role: OrgRole
  createdAt: Date | string
  user: { id: string; name: string; email: string; image: string | null }
}

const ROLE_KEY: Record<OrgRole, MessageKey> = {
  OWNER: 'status.OWNER',
  ADMIN: 'status.ADMIN',
  MEMBER: 'status.MEMBER',
}

export function MembersTable({
  members,
  canManage,
  currentUserId,
  currentRole,
}: {
  members: TeamMember[]
  canManage: boolean
  currentUserId: string
  currentRole: OrgRole
}) {
  const { isPending, run } = useAction()
  const t = useT()
  const [query, setQuery] = useState('')
  const [pendingRemoval, setPendingRemoval] = useState<TeamMember | null>(null)
  const [pendingTransfer, setPendingTransfer] = useState<TeamMember | null>(null)

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return members
    return members.filter(
      (member) =>
        member.user.name.toLowerCase().includes(term) ||
        member.user.email.toLowerCase().includes(term) ||
        t(ROLE_KEY[member.role]).toLowerCase().includes(term)
    )
  }, [members, query, t])

  const changeRole = (member: TeamMember, role: OrgRole) => {
    if (role === member.role) return
    run(() => updateMemberRoleAction({ membershipId: member.id, role }), {
      success: t('membersTable.roleUpdatedTo', { role: t(ROLE_KEY[role]) }),
    })
  }

  const confirmRemove = () => {
    const member = pendingRemoval
    setPendingRemoval(null)
    if (member)
      run(() => removeMemberAction({ membershipId: member.id }), { success: t('members.removed') })
  }

  const confirmTransfer = () => {
    const member = pendingTransfer
    setPendingTransfer(null)
    if (member)
      run(() => transferOwnershipAction({ membershipId: member.id }), {
        success: t('membersTable.transferred', { name: member.user.name }),
      })
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            id="member-search"
            name="memberSearch"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('membersTable.search')}
            className="pl-9"
            aria-label={t('membersTable.search')}
          />
        </div>
        <p className="text-muted-foreground text-sm">
          {t('membersTable.memberCount', { count: members.length })}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={UsersIcon} title={t('membersTable.emptySearch')} />
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('members.member')}</TableHead>
                <TableHead>{t('members.joined')}</TableHead>
                <TableHead className="text-right">{t('members.role')}</TableHead>
                {canManage && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((member) => {
                const isSelf = member.user.id === currentUserId
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                          {initials(member.user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {member.user.name}
                            {isSelf && (
                              <span className="text-muted-foreground ml-2 text-xs">
                                ({t('members.you')})
                              </span>
                            )}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">{member.user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(member.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {canManage ? (
                        <Select
                          value={member.role}
                          onValueChange={(value) => changeRole(member, value as OrgRole)}
                          disabled={isPending}
                        >
                          <SelectTrigger
                            size="sm"
                            id={`role-${member.id}`}
                            className="ml-auto w-32"
                            aria-label={t('membersTable.roleFor', { name: member.user.name })}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(ROLE_KEY) as OrgRole[]).map((role) => (
                              <SelectItem key={role} value={role}>
                                {t(ROLE_KEY[role])}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">{t(ROLE_KEY[member.role])}</Badge>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {!isSelf && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('membersTable.manage', { name: member.user.name })}
                              >
                                <MoreVerticalIcon />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {currentRole === 'OWNER' && member.role !== 'OWNER' && (
                                <>
                                  <DropdownMenuItem
                                    onSelect={(event) => {
                                      event.preventDefault()
                                      setPendingTransfer(member)
                                    }}
                                  >
                                    <UserCogIcon />
                                    {t('membersTable.transfer')}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={(event) => {
                                  event.preventDefault()
                                  setPendingRemoval(member)
                                }}
                              >
                                <Trash2Icon />
                                {t('membersTable.remove')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!pendingRemoval} onOpenChange={(open) => !open && setPendingRemoval(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('membersTable.removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('membersTable.removeBody', { name: pendingRemoval?.user.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmRemove}
            >
              {isPending && <Loader2Icon className="animate-spin" />}
              {t('membersTable.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingTransfer} onOpenChange={(open) => !open && setPendingTransfer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('membersTable.transferTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('membersTable.transferBody', { name: pendingTransfer?.user.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTransfer}>
              {isPending && <Loader2Icon className="animate-spin" />}
              {t('membersTable.transferAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
