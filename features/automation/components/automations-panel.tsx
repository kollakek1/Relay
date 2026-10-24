'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { formatRelativeTime } from '@/shared/lib/format'
import {
  createAutomationAction,
  deleteAutomationAction,
  toggleAutomationAction,
} from '@/features/automation/actions'
import { Loader2Icon, PlusIcon, Trash2Icon, ZapIcon } from 'lucide-react'

const TRIGGERS = [
  'task.created',
  'task.claimed',
  'task.completed',
  'task.decided',
  'instance.started',
  'instance.completed',
  'workflow.published',
] as const

const ACTIONS = ['notify_role', 'add_tag', 'set_priority', 'create_task'] as const

export interface AutomationRow {
  id: string
  name: string
  enabled: boolean
  trigger: string
  action: string
  lastRunAt: Date | string | null
  runs: number
}

export interface AutomationRunRow {
  id: string
  ruleName: string
  status: string
  detail: string | null
  createdAt: Date | string
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  SUCCESS: 'default',
  PENDING: 'secondary',
  FAILED: 'destructive',
}

export function AutomationsPanel({
  rules,
  runs,
  canManage,
}: {
  rules: AutomationRow[]
  runs: AutomationRunRow[]
  canManage: boolean
}) {
  const router = useRouter()
  const { isPending, run } = useAction()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState<string>('task.completed')
  const [action, setAction] = useState<string>('notify_role')
  const [param, setParam] = useState('MEMBER')
  const [pendingDelete, setPendingDelete] = useState<AutomationRow | null>(null)

  if (!canManage) return null

  const config = () => {
    if (action === 'notify_role') return { role: param }
    if (action === 'add_tag') return { tag: param }
    if (action === 'set_priority') return { priority: param }
    return { name: param }
  }

  const create = () =>
    run(() => createAutomationAction({ name, trigger, action, config: config() }), {
      success: 'Automation created',
      onSuccess: () => {
        setOpen(false)
        setName('')
        router.refresh()
      },
    })

  const paramLabel =
    action === 'notify_role'
      ? 'Role to notify'
      : action === 'add_tag'
        ? 'Tag'
        : action === 'set_priority'
          ? 'Priority'
          : 'Task name'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Automations</h3>
          <p className="text-muted-foreground text-sm">
            Rules that react to process events — no worker required.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusIcon />
              New rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New automation</DialogTitle>
              <DialogDescription>
                When the trigger fires, the action runs once per event.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="automation-name">Name</Label>
                <Input
                  id="automation-name"
                  value={name}
                  autoComplete="off"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Tag urgent completions"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="automation-trigger">Trigger</Label>
                  <Select value={trigger} onValueChange={setTrigger}>
                    <SelectTrigger id="automation-trigger" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGERS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="automation-action">Action</Label>
                  <Select value={action} onValueChange={setAction}>
                    <SelectTrigger id="automation-action" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="automation-param">{paramLabel}</Label>
                {action === 'notify_role' ? (
                  <Select value={param} onValueChange={setParam}>
                    <SelectTrigger id="automation-param" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Member and above</SelectItem>
                      <SelectItem value="ADMIN">Admin and above</SelectItem>
                      <SelectItem value="OWNER">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                ) : action === 'set_priority' ? (
                  <Select value={param} onValueChange={setParam}>
                    <SelectTrigger id="automation-param" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">LOW</SelectItem>
                      <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                      <SelectItem value="HIGH">HIGH</SelectItem>
                      <SelectItem value="URGENT">URGENT</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="automation-param"
                    value={param}
                    autoComplete="off"
                    onChange={(event) => setParam(event.target.value)}
                  />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={create} disabled={isPending || name.trim().length < 2 || !param.trim()}>
                {isPending && <Loader2Icon className="animate-spin" />}
                Create rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {rules.length === 0 ? (
        <p className="text-muted-foreground text-sm">No automations yet.</p>
      ) : (
        <div className="divide-border border-border divide-y rounded-lg border">
          {rules.map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center gap-3 p-3">
              <ZapIcon className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{rule.name}</p>
                <p className="text-muted-foreground text-xs">
                  {rule.trigger} → {rule.action} · {rule.runs} run
                  {rule.runs === 1 ? '' : 's'}
                  {rule.lastRunAt ? ` · last ${formatRelativeTime(rule.lastRunAt)}` : ''}
                </p>
              </div>
              <Badge variant={rule.enabled ? 'secondary' : 'outline'}>
                {rule.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(() => toggleAutomationAction({ id: rule.id, enabled: !rule.enabled }), {
                    success: rule.enabled ? 'Rule disabled' : 'Rule enabled',
                  })
                }
              >
                {rule.enabled ? 'Disable' : 'Enable'}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${rule.name}`}
                onClick={() => setPendingDelete(rule)}
              >
                <Trash2Icon className="text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {runs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Recent runs</h4>
          <div className="divide-border border-border max-h-64 divide-y overflow-y-auto rounded-lg border">
            {runs.map((run_) => (
              <div key={run_.id} className="flex flex-wrap items-center gap-2 p-2 text-xs">
                <Badge variant={STATUS_VARIANT[run_.status] ?? 'outline'}>{run_.status}</Badge>
                <span className="font-medium">{run_.ruleName}</span>
                {run_.detail && <span className="text-muted-foreground truncate">{run_.detail}</span>}
                <span className="text-muted-foreground ml-auto">
                  {formatRelativeTime(run_.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(next) => !next && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete automation?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” will stop running. Its history is removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const rule = pendingDelete
                setPendingDelete(null)
                if (rule)
                  run(() => deleteAutomationAction({ id: rule.id }), {
                    success: 'Automation deleted',
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
