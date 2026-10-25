'use client'

import { useMemo, useState } from 'react'
import { Loader2Icon, ShieldCheckIcon } from 'lucide-react'
import type { OrgRole } from '@/prisma/generated/prisma/enums'
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  type Permission,
} from '@/shared/server/permissions'
import type { MessageKey } from '@/shared/i18n/translate'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { updateMemberPermissionsAction } from '@/features/organization/actions'
import { useAction } from '@/shared/hooks/useAction'
import { useT } from '@/shared/i18n/provider'

export interface MemberAccessRow {
  membershipId: string
  userId: string
  name: string
  email: string
  role: OrgRole
  grantedPermissions: string[]
}

function permissionLabel(key: Permission): MessageKey {
  return `permissions.${key}` as MessageKey
}

/**
 * Admin view for granting extra permissions to members. Baseline permissions
 * (implied by the role) are shown checked and disabled; only *additional*
 * permissions can be granted, and only ones the actor holds herself.
 */
export function MemberPermissionsPanel({
  members,
  actorPermissions,
  currentUserId,
}: {
  members: MemberAccessRow[]
  actorPermissions: Permission[]
  currentUserId: string
}) {
  const t = useT()
  const { isPending, run } = useAction()
  const [editing, setEditing] = useState<MemberAccessRow | null>(null)
  const [selected, setSelected] = useState<Set<Permission>>(new Set())

  const grantable = useMemo(() => new Set(actorPermissions), [actorPermissions])

  function open(member: MemberAccessRow) {
    setEditing(member)
    setSelected(new Set(member.grantedPermissions.filter((p): p is Permission => grantable.has(p as Permission))))
  }

  function toggle(permission: Permission) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(permission)) next.delete(permission)
      else next.add(permission)
      return next
    })
  }

  function save() {
    if (!editing) return
    // Send baseline + selected so the server can normalise to the minimal grant set.
    const baseline = ROLE_PERMISSIONS[editing.role] ?? []
    const payload = [...new Set([...baseline, ...selected])]
    run(() => updateMemberPermissionsAction({ membershipId: editing.membershipId, permissions: payload }), {
      success: t('access.saved'),
      onSuccess: () => setEditing(null),
    })
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('access.member')}</TableHead>
            <TableHead>{t('access.role')}</TableHead>
            <TableHead>{t('access.grantedNote')}</TableHead>
            <TableHead className="text-right">{t('archive.columns')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.membershipId}>
              <TableCell>
                <p className="font-medium">
                  {member.name}
                  {member.userId === currentUserId && (
                    <span className="text-muted-foreground ml-2 text-xs">({t('common.you')})</span>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">{member.email}</p>
              </TableCell>
              <TableCell>
                <Badge>{t(`status.${member.role}` as MessageKey)}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {member.grantedPermissions.length === 0 ? (
                    <span className="text-muted-foreground text-xs">{t('access.none')}</span>
                  ) : (
                    member.grantedPermissions.map((permission) => (
                      <Badge key={permission} variant="outline" className="text-xs">
                        {t(permissionLabel(permission as Permission))}
                      </Badge>
                    ))
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => open(member)}>
                  <ShieldCheckIcon />
                  <span className="sr-only sm:not-sr-only">{t('access.edit')}</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('access.editTitle', { name: editing?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('access.editBody')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {PERMISSIONS.map((permission) => {
              const baseline = (ROLE_PERMISSIONS[editing?.role ?? 'MEMBER'] ?? []).includes(permission)
              const canGrant = grantable.has(permission)
              const checked = baseline || selected.has(permission)
              return (
                <label
                  key={permission}
                  className="flex items-start gap-3 rounded-md px-2 py-1.5 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    disabled={baseline || !canGrant}
                    onCheckedChange={() => !baseline && canGrant && toggle(permission)}
                    aria-label={t(permissionLabel(permission))}
                  />
                  <span className={baseline ? 'font-medium' : undefined}>
                    {t(permissionLabel(permission))}
                  </span>
                </label>
              )
            })}
          </div>
          <p className="text-muted-foreground text-xs">{t('access.baselineNote')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save} disabled={isPending}>
              {isPending && <Loader2Icon className="animate-spin" />}
              {t('access.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
