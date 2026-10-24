'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Checkbox } from '@/shared/components/ui/checkbox'
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
import { useT } from '@/shared/i18n/provider'
import { formatDate, formatRelativeTime } from '@/shared/lib/format'
import { toast } from 'sonner'
import { createApiKeyAction, revokeApiKeyAction } from '@/features/api/actions'
import { Loader2Icon, PlusIcon, KeyRoundIcon, Trash2Icon } from 'lucide-react'

const SCOPES = [
  'workflows:read',
  'tasks:read',
  'tasks:write',
  'instances:read',
  'instances:write',
] as const

export interface ApiKeyRow {
  id: string
  name: string
  prefix: string
  scopes: string[]
  lastUsedAt: Date | string | null
  revokedAt: Date | string | null
  createdAt: Date | string
}

export function ApiKeysPanel({ keys, canManage }: { keys: ApiKeyRow[]; canManage: boolean }) {
  const router = useRouter()
  const { isPending, run } = useAction()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['workflows:read', 'tasks:read'])
  const [token, setToken] = useState<string | null>(null)
  const [pendingRevoke, setPendingRevoke] = useState<ApiKeyRow | null>(null)

  if (!canManage) return null

  const create = () =>
    run(() => createApiKeyAction({ name, scopes }), {
      onSuccess: (data) => {
        setToken(data.token)
        setName('')
        setOpen(false)
        router.refresh()
      },
    })

  const toggleScope = (scope: string) =>
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]))

  const copyToken = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      toast.success(t('apiKeys.copied'))
    } catch {
      toast.error(t('apiKeys.copyFailed'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{t('apiKeys.title')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('apiKeys.subtitleBefore')}
            <code>/api/v1</code>
            {t('apiKeys.subtitleAfter')}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusIcon />
              {t('apiKeys.newKey')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('apiKeys.createTitle')}</DialogTitle>
              <DialogDescription>{t('apiKeys.createBody')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key-name">{t('apiKeys.name')}</Label>
                <Input
                  id="api-key-name"
                  value={name}
                  autoComplete="off"
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t('apiKeys.namePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('apiKeys.scopes')}</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SCOPES.map((scope) => (
                    <label key={scope} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={scopes.includes(scope)}
                        onCheckedChange={() => toggleScope(scope)}
                      />
                      {scope}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={create} disabled={isPending || name.trim().length < 2 || scopes.length === 0}>
                {isPending && <Loader2Icon className="animate-spin" />}
                {t('apiKeys.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {token && (
        <div className="border-border bg-muted/40 space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">{t('apiKeys.copyNow')}</p>
          <div className="flex items-center gap-2">
            <code className="bg-background min-w-0 flex-1 truncate rounded border px-2 py-1 text-xs">
              {token}
            </code>
            <Button variant="outline" size="sm" onClick={copyToken}>
              {t('common.copy')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setToken(null)}>
              {t('common.dismiss')}
            </Button>
          </div>
        </div>
      )}

      {keys.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('apiKeys.empty')}</p>
      ) : (
        <div className="divide-border border-border divide-y rounded-lg border">
          {keys.map((key) => (
            <div key={key.id} className="flex flex-wrap items-center gap-3 p-3">
              <KeyRoundIcon className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {key.name}{' '}
                  <span className="text-muted-foreground font-mono text-xs">{key.prefix}</span>
                </p>
                <p className="text-muted-foreground text-xs">
                  {key.scopes.join(', ')} · {t('apiKeys.created', { date: formatDate(key.createdAt) })}{' '}
                  ·{' '}
                  {key.lastUsedAt
                    ? t('apiKeys.used', { time: formatRelativeTime(key.lastUsedAt) })
                    : t('apiKeys.neverUsed')}
                </p>
              </div>
              {key.revokedAt ? (
                <Badge variant="outline">{t('apiKeys.revoked')}</Badge>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('apiKeys.revokeKey', { name: key.name })}
                  onClick={() => setPendingRevoke(key)}
                >
                  <Trash2Icon className="text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!pendingRevoke} onOpenChange={(next) => !next && setPendingRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('apiKeys.revokeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('apiKeys.revokeBodyBefore')}
              <strong>{pendingRevoke?.name}</strong>
              {t('apiKeys.revokeBodyAfter')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const key = pendingRevoke
                setPendingRevoke(null)
                if (key)
                  run(() => revokeApiKeyAction({ id: key.id }), {
                    success: t('toast.apiKeyRevoked'),
                  })
              }}
            >
              {t('apiKeys.revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
