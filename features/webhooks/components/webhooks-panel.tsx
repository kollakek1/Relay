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
import type { MessageKey } from '@/shared/i18n/translate'
import { formatRelativeTime } from '@/shared/lib/format'
import { toast } from 'sonner'
import {
  createWebhookAction,
  deleteWebhookAction,
  retryDeliveryAction,
  updateWebhookAction,
} from '@/features/webhooks/actions'
import { Loader2Icon, PlusIcon, RefreshCwIcon, Trash2Icon, WebhookIcon } from 'lucide-react'

const EVENTS = [
  'task.created',
  'task.claimed',
  'task.completed',
  'task.decided',
  'instance.started',
  'instance.completed',
  'workflow.published',
] as const

export interface WebhookRow {
  id: string
  url: string
  events: string[]
  active: boolean
  failureCount: number
  deliveries: number
}

export interface DeliveryRow {
  id: string
  event: string
  status: string
  attempts: number
  responseCode: number | null
  error: string | null
  createdAt: Date | string
  endpointUrl: string
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DELIVERED: 'default',
  PENDING: 'secondary',
  FAILED: 'destructive',
}

const STATUS_KEY: Record<string, MessageKey> = {
  DELIVERED: 'webhooks.delivered',
  PENDING: 'webhooks.pending',
  FAILED: 'webhooks.failed',
}

export function WebhooksPanel({
  endpoints,
  deliveries,
  canManage,
}: {
  endpoints: WebhookRow[]
  deliveries: DeliveryRow[]
  canManage: boolean
}) {
  const router = useRouter()
  const { isPending, run } = useAction()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>(['task.completed'])
  const [secret, setSecret] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<WebhookRow | null>(null)

  if (!canManage) return null

  const toggleEvent = (event: string) =>
    setEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]))

  const create = () =>
    run(() => createWebhookAction({ url, events }), {
      onSuccess: (data) => {
        setSecret(data.secret)
        setUrl('')
        setOpen(false)
        router.refresh()
      },
    })

  const copySecret = async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      toast.success(t('webhooks.copied'))
    } catch {
      toast.error(t('webhooks.copyFailed'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{t('webhooks.title')}</h3>
          <p className="text-muted-foreground text-sm">{t('webhooks.subtitle')}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusIcon />
              {t('webhooks.addEndpoint')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('webhooks.addTitle')}</DialogTitle>
              <DialogDescription>{t('webhooks.addBody')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-url">{t('webhooks.url')}</Label>
                <Input
                  id="webhook-url"
                  value={url}
                  autoComplete="off"
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder={t('webhooks.urlPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('webhooks.events')}</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {EVENTS.map((event) => (
                    <label key={event} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={events.includes(event)}
                        onCheckedChange={() => toggleEvent(event)}
                      />
                      {event}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={create} disabled={isPending || !url.trim() || events.length === 0}>
                {isPending && <Loader2Icon className="animate-spin" />}
                {t('webhooks.addEndpoint')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {secret && (
        <div className="border-border bg-muted/40 space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">{t('webhooks.secretWarning')}</p>
          <div className="flex items-center gap-2">
            <code className="bg-background min-w-0 flex-1 truncate rounded border px-2 py-1 text-xs">
              {secret}
            </code>
            <Button variant="outline" size="sm" onClick={copySecret}>
              {t('common.copy')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSecret(null)}>
              {t('common.dismiss')}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            {t('webhooks.verifyBefore')}
            <code>HMAC-SHA256(timestamp + &quot;.&quot; + body)</code>
            {t('webhooks.verifyMiddle')}
            <code>x-relay-signature</code>
            {t('webhooks.verifyAfter')}
          </p>
        </div>
      )}

      {endpoints.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('webhooks.empty')}</p>
      ) : (
        <div className="divide-border border-border divide-y rounded-lg border">
          {endpoints.map((endpoint) => (
            <div key={endpoint.id} className="flex flex-wrap items-center gap-3 p-3">
              <WebhookIcon className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs">{endpoint.url}</p>
                <p className="text-muted-foreground text-xs">
                  {endpoint.events.join(', ')} ·{' '}
                  {t('webhooks.deliveries', { count: endpoint.deliveries })}
                  {endpoint.failureCount > 0
                    ? ` · ${t('webhooks.recentFailures', { count: endpoint.failureCount })}`
                    : ''}
                </p>
              </div>
              <Badge variant={endpoint.active ? 'secondary' : 'outline'}>
                {endpoint.active ? t('webhooks.active') : t('webhooks.disabled')}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(
                    () => updateWebhookAction({ id: endpoint.id, active: !endpoint.active }),
                    {
                      success: endpoint.active
                        ? t('webhooks.endpointDisabled')
                        : t('webhooks.endpointEnabled'),
                    }
                  )
                }
              >
                {endpoint.active ? t('webhooks.disable') : t('webhooks.enable')}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('webhooks.deleteEndpoint')}
                onClick={() => setPendingDelete(endpoint)}
              >
                <Trash2Icon className="text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {deliveries.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">{t('webhooks.recentDeliveries')}</h4>
          <div className="divide-border border-border max-h-80 divide-y overflow-y-auto rounded-lg border">
            {deliveries.map((delivery) => (
              <div key={delivery.id} className="flex flex-wrap items-center gap-2 p-2 text-xs">
                <Badge variant={STATUS_VARIANT[delivery.status] ?? 'outline'}>
                  {STATUS_KEY[delivery.status] ? t(STATUS_KEY[delivery.status]) : delivery.status}
                </Badge>
                <span className="font-medium">{delivery.event}</span>
                <span className="text-muted-foreground truncate">{delivery.endpointUrl}</span>
                <span className="text-muted-foreground ml-auto">
                  {t('webhooks.attempts', { count: delivery.attempts })}
                  {delivery.responseCode ? ` · HTTP ${delivery.responseCode}` : ''} ·{' '}
                  {formatRelativeTime(delivery.createdAt)}
                </span>
                {delivery.status === 'FAILED' && (
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={isPending}
                    onClick={() =>
                      run(() => retryDeliveryAction({ id: delivery.id }), {
                        success: t('webhooks.requeued'),
                      })
                    }
                  >
                    <RefreshCwIcon />
                    {t('webhooks.retry')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(next) => !next && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('webhooks.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('webhooks.deleteBody', { url: pendingDelete?.url ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const endpoint = pendingDelete
                setPendingDelete(null)
                if (endpoint)
                  run(() => deleteWebhookAction({ id: endpoint.id }), {
                    success: t('toast.webhookDeleted'),
                  })
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
