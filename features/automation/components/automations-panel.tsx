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
import { useT } from '@/shared/i18n/provider'
import type { MessageKey } from '@/shared/i18n/translate'
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

const STATUS_KEY: Record<string, MessageKey> = {
  SUCCESS: 'automations.success',
  PENDING: 'automations.pending',
  FAILED: 'automations.failed',
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
  const t = useT()
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
      success: t('toast.automationCreated'),
      onSuccess: () => {
        setOpen(false)
        setName('')
        router.refresh()
      },
    })

  const paramLabel =
    action === 'notify_role'
      ? t('automations.paramRole')
      : action === 'add_tag'
        ? t('automations.paramTag')
        : action === 'set_priority'
          ? t('automations.paramPriority')
          : t('automations.paramTaskName')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{t('automations.title')}</h3>
          <p className="text-muted-foreground text-sm">{t('automations.subtitle')}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusIcon />
              {t('automations.newRule')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('automations.createTitle')}</DialogTitle>
              <DialogDescription>{t('automations.createBody')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="automation-name">{t('automations.name')}</Label>
                <Input
                  id="automation-name"
                  value={name}
                  autoComplete="off"
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t('automations.namePlaceholder')}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="automation-trigger">{t('automations.trigger')}</Label>
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
                  <Label htmlFor="automation-action">{t('automations.action')}</Label>
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
                      <SelectItem value="MEMBER">{t('automations.memberAndAbove')}</SelectItem>
                      <SelectItem value="ADMIN">{t('automations.adminAndAbove')}</SelectItem>
                      <SelectItem value="OWNER">{t('status.OWNER')}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : action === 'set_priority' ? (
                  <Select value={param} onValueChange={setParam}>
                    <SelectTrigger id="automation-param" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">{t('status.LOW')}</SelectItem>
                      <SelectItem value="MEDIUM">{t('status.MEDIUM')}</SelectItem>
                      <SelectItem value="HIGH">{t('status.HIGH')}</SelectItem>
                      <SelectItem value="URGENT">{t('status.URGENT')}</SelectItem>
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
                {t('common.cancel')}
              </Button>
              <Button onClick={create} disabled={isPending || name.trim().length < 2 || !param.trim()}>
                {isPending && <Loader2Icon className="animate-spin" />}
                {t('automations.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {rules.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('automations.empty')}</p>
      ) : (
        <div className="divide-border border-border divide-y rounded-lg border">
          {rules.map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center gap-3 p-3">
              <ZapIcon className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{rule.name}</p>
                <p className="text-muted-foreground text-xs">
                  {rule.trigger} → {rule.action} · {t('automations.runCount', { count: rule.runs })}
                  {rule.lastRunAt
                    ? ` · ${t('automations.lastRun', { time: formatRelativeTime(rule.lastRunAt) })}`
                    : ''}
                </p>
              </div>
              <Badge variant={rule.enabled ? 'secondary' : 'outline'}>
                {rule.enabled ? t('automations.enabled') : t('automations.disabled')}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(() => toggleAutomationAction({ id: rule.id, enabled: !rule.enabled }), {
                    success: rule.enabled ? t('automations.ruleDisabled') : t('automations.ruleEnabled'),
                  })
                }
              >
                {rule.enabled ? t('automations.disable') : t('automations.enable')}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('automations.deleteRule', { name: rule.name })}
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
          <h4 className="text-sm font-medium">{t('automations.recentRuns')}</h4>
          <div className="divide-border border-border max-h-64 divide-y overflow-y-auto rounded-lg border">
            {runs.map((run_) => (
              <div key={run_.id} className="flex flex-wrap items-center gap-2 p-2 text-xs">
                <Badge variant={STATUS_VARIANT[run_.status] ?? 'outline'}>
                  {STATUS_KEY[run_.status] ? t(STATUS_KEY[run_.status]) : run_.status}
                </Badge>
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
            <AlertDialogTitle>{t('automations.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('automations.deleteBody', { name: pendingDelete?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const rule = pendingDelete
                setPendingDelete(null)
                if (rule)
                  run(() => deleteAutomationAction({ id: rule.id }), {
                    success: t('toast.automationDeleted'),
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
