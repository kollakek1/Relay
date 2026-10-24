'use client'

import { useState } from 'react'
import type { OrgRole } from '@/prisma/generated/prisma/enums'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
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
import { Loader2Icon, Trash2Icon } from 'lucide-react'
import { updateMemberRoleAction, removeMemberAction } from '@/features/organization/actions'
import { useAction } from '@/shared/hooks/useAction'
import { formatDate, initials } from '@/shared/lib/format'

export interface TeamMember {
  id: string
  role: OrgRole
  createdAt: Date | string
  user: { id: string; name: string; email: string; image: string | null }
}

const ROLE_LABELS: Record<OrgRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
}

export function MembersTable({
  members,
  canManage,
  currentUserId,
}: {
  members: TeamMember[]
  canManage: boolean
  currentUserId: string
}) {
  const { isPending, run } = useAction()
  const [pendingRemoval, setPendingRemoval] = useState<TeamMember | null>(null)

  const changeRole = (member: TeamMember, role: OrgRole) => {
    if (role === member.role) return
    run(() => updateMemberRoleAction({ membershipId: member.id, role }), {
      success: `Role updated to ${ROLE_LABELS[role]}`,
    })
  }

  return (
    <>
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Role</TableHead>
              {canManage && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                      {initials(member.user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {member.user.name}
                        {member.user.id === currentUserId && (
                          <span className="text-muted-foreground ml-2 text-xs">(you)</span>
                        )}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">{member.user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(member.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  {canManage ? (
                    <Select
                      value={member.role}
                      onValueChange={(value) => changeRole(member, value as OrgRole)}
                      disabled={isPending}
                    >
                      <SelectTrigger size="sm" className="ml-auto w-32" aria-label="Member role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ROLE_LABELS) as OrgRole[]).map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    {member.user.id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${member.user.name}`}
                        onClick={() => setPendingRemoval(member)}
                      >
                        <Trash2Icon className="text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!pendingRemoval} onOpenChange={(open) => !open && setPendingRemoval(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval?.user.name} will lose access to this workspace. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const member = pendingRemoval
                setPendingRemoval(null)
                if (member) {
                  run(() => removeMemberAction({ membershipId: member.id }), {
                    success: 'Member removed',
                  })
                }
              }}
            >
              {isPending && <Loader2Icon className="animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
