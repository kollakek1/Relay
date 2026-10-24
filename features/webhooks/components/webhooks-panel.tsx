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
      toast.success('Signing secret copied')
    } catch {
      toast.error('Copy failed — select the secret manually')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Webhooks</h3>
          <p className="text-muted-foreground text-sm">
            Signed POST requests for domain events, delivered with retries.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusIcon />
              Add endpoint
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add webhook endpoint</DialogTitle>
              <DialogDescription>
                https only for public hosts. Private/loopback addresses are rejected.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Endpoint URL</Label>
                <Input
                  id="webhook-url"
                  value={url}
                  autoComplete="off"
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com/hooks/relay"
                />
              </div>
              <div className="space-y-2">
                <Label>Events</Label>
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
                Cancel
              </Button>
              <Button onClick={create} disabled={isPending || !url.trim() || events.length === 0}>
                {isPending && <Loader2Icon className="animate-spin" />}
                Add endpoint
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {secret && (
        <div className="border-border bg-muted/40 space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">
            Signing secret — store it now, it is shown only once.
          </p>
          <div className="flex items-center gap-2">
            <code className="bg-background min-w-0 flex-1 truncate rounded border px-2 py-1 text-xs">
              {secret}
            </code>
            <Button variant="outline" size="sm" onClick={copySecret}>
              Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSecret(null)}>
              Dismiss
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Verify with <code>HMAC-SHA256(timestamp + &quot;.&quot; + body)</code> against the{' '}
            <code>x-relay-signature</code> header.
          </p>
        </div>
      )}

      {endpoints.length === 0 ? (
        <p className="text-muted-foreground text-sm">No webhook endpoints yet.</p>
      ) : (
        <div className="divide-border border-border divide-y rounded-lg border">
          {endpoints.map((endpoint) => (
            <div key={endpoint.id} className="flex flex-wrap items-center gap-3 p-3">
              <WebhookIcon className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs">{endpoint.url}</p>
                <p className="text-muted-foreground text-xs">
                  {endpoint.events.join(', ')} · {endpoint.deliveries} deliveries
                  {endpoint.failureCount > 0 ? ` · ${endpoint.failureCount} recent failures` : ''}
                </p>
              </div>
              <Badge variant={endpoint.active ? 'secondary' : 'outline'}>
                {endpoint.active ? 'Active' : 'Disabled'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(
                    () => updateWebhookAction({ id: endpoint.id, active: !endpoint.active }),
                    { success: endpoint.active ? 'Endpoint disabled' : 'Endpoint enabled' }
                  )
                }
              >
                {endpoint.active ? 'Disable' : 'Enable'}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete endpoint"
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
          <h4 className="text-sm font-medium">Recent deliveries</h4>
          <div className="divide-border border-border max-h-80 divide-y overflow-y-auto rounded-lg border">
            {deliveries.map((delivery) => (
              <div key={delivery.id} className="flex flex-wrap items-center gap-2 p-2 text-xs">
                <Badge variant={STATUS_VARIANT[delivery.status] ?? 'outline'}>{delivery.status}</Badge>
                <span className="font-medium">{delivery.event}</span>
                <span className="text-muted-foreground truncate">{delivery.endpointUrl}</span>
                <span className="text-muted-foreground ml-auto">
                  {delivery.attempts} attempt{delivery.attempts === 1 ? '' : 's'}
                  {delivery.responseCode ? ` · HTTP ${delivery.responseCode}` : ''} ·{' '}
                  {formatRelativeTime(delivery.createdAt)}
                </span>
                {delivery.status === 'FAILED' && (
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={isPending}
                    onClick={() =>
                      run(() => retryDeliveryAction({ id: delivery.id }), { success: 'Re-queued' })
                    }
                  >
                    <RefreshCwIcon />
                    Retry
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
            <AlertDialogTitle>Delete webhook endpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.url} will stop receiving events and its delivery log will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const endpoint = pendingDelete
                setPendingDelete(null)
                if (endpoint)
                  run(() => deleteWebhookAction({ id: endpoint.id }), {
                    success: 'Endpoint deleted',
                  })
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
