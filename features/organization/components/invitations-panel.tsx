'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InvitationStatus, OrgRole } from '@/prisma/generated/prisma/enums'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog'
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
import { useAction } from '@/shared/hooks/useAction'
import { formatDate, isOverdue } from '@/shared/lib/format'
import { toast } from 'sonner'
import {
  createInvitationAction,
  resendInvitationAction,
  revokeInvitationAction,
} from '@/features/organization/actions'
import { CopyIcon, Loader2Icon, MailIcon, PlusIcon, RefreshCwIcon, XIcon } from 'lucide-react'

export interface InvitationRow {
  id: string
  email: string
  role: OrgRole
  status: InvitationStatus
  expiresAt: Date | string
  invitedBy: { id: string; name: string }
}

const STATUS_VARIANT: Record<InvitationStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'default',
  ACCEPTED: 'secondary',
  REVOKED: 'outline',
  EXPIRED: 'destructive',
}

function effectiveStatus(invitation: InvitationRow): InvitationStatus {
  if (invitation.status === 'PENDING' && isOverdue(invitation.expiresAt)) return 'EXPIRED'
  return invitation.status
}

export function InvitationsPanel({
  invitations,
  canManage,
  canInviteOwner,
}: {
  invitations: InvitationRow[]
  canManage: boolean
  canInviteOwner: boolean
}) {
  const router = useRouter()
  const { isPending, run } = useAction()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrgRole>('MEMBER')
  const [lastLink, setLastLink] = useState<string | null>(null)
  const [pendingRevoke, setPendingRevoke] = useState<InvitationRow | null>(null)

  if (!canManage) {
    return null
  }

  const invite = () => {
    run(() => createInvitationAction({ email, role }), {
      onSuccess: (data) => {
        setLastLink(data.link)
        toast.success(
          data.delivered
            ? 'Invitation sent'
            : 'Invitation created — share the link below (no email provider configured)'
        )
        setOpen(false)
        setEmail('')
        setRole('MEMBER')
        router.refresh()
      },
    })
  }

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Invitation link copied')
    } catch {
      toast.error('Could not copy — select and copy manually')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Invitations</h2>
          <p className="text-muted-foreground text-sm">Invite teammates to this workspace.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon />
              Invite
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite a teammate</DialogTitle>
              <DialogDescription>
                They will receive an email with a link to join this workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="teammate@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={role} onValueChange={(value) => setRole(value as OrgRole)}>
                  <SelectTrigger id="invite-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    {canInviteOwner && <SelectItem value="OWNER">Owner</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={invite} disabled={isPending || !email.trim()}>
                {isPending ? <Loader2Icon className="animate-spin" /> : <MailIcon />}
                Send invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {lastLink && (
        <div className="border-border bg-muted/40 flex items-center gap-2 rounded-lg border p-3 text-sm">
          <span className="text-muted-foreground shrink-0">Invite link</span>
          <code className="truncate text-xs">{lastLink}</code>
          <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={() => copy(lastLink)}>
            <CopyIcon />
            Copy
          </Button>
        </div>
      )}

      {invitations.length === 0 ? (
        <p className="text-muted-foreground text-sm">No invitations yet.</p>
      ) : (
        <div className="space-y-2">
          {invitations.map((invitation) => {
            const status = effectiveStatus(invitation)
            return (
              <div
                key={invitation.id}
                className="border-border bg-card flex flex-wrap items-center gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{invitation.email}</p>
                  <p className="text-muted-foreground text-xs">
                    {invitation.role} · invited by {invitation.invitedBy.name} ·{' '}
                    {status === 'PENDING'
                      ? `expires ${formatDate(invitation.expiresAt)}`
                      : formatDate(invitation.expiresAt)}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
                {status === 'PENDING' && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Resend invitation"
                      disabled={isPending}
                      onClick={() =>
                        run(() => resendInvitationAction({ invitationId: invitation.id }), {
                          success: 'Invitation resent',
                          onSuccess: (data) => {
                            setLastLink(data.link)
                            router.refresh()
                          },
                        })
                      }
                    >
                      <RefreshCwIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Revoke invitation"
                      disabled={isPending}
                      onClick={() => setPendingRevoke(invitation)}
                    >
                      <XIcon className="text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AlertDialog open={!!pendingRevoke} onOpenChange={(open) => !open && setPendingRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              The link for {pendingRevoke?.email} will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const invitation = pendingRevoke
                setPendingRevoke(null)
                if (invitation)
                  run(() => revokeInvitationAction({ invitationId: invitation.id }), {
                    success: 'Invitation revoked',
                  })
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
