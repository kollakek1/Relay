'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ActivityType, OrgRole, TaskPriority, TaskStatus } from '@/prisma/generated/prisma/enums'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Separator } from '@/shared/components/ui/separator'
import { Badge } from '@/shared/components/ui/badge'
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
import { formatDateTime, formatRelativeTime } from '@/shared/lib/format'
import {
  addCommentAction,
} from '@/features/activity/actions'
import {
  assignTaskAction,
  claimTaskAction,
  decideTaskAction,
  reopenTaskAction,
  transitionTaskAction,
  updateTaskAction,
} from '@/features/task/actions'
import { PRIORITY_KEY, TaskPriorityBadge, TaskStatusBadge } from './task-badges'
import type { WorkflowFormField } from '@/features/workflow/server/engine'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  CheckCircle2Icon,
  HandIcon,
  Loader2Icon,
  PlayIcon,
  RotateCcwIcon,
  SendIcon,
  XIcon,
} from 'lucide-react'

const ACTIVITY_KEY: Record<ActivityType, MessageKey> = {
  CREATED: 'taskDetail.activityCreated',
  CLAIMED: 'taskDetail.activityClaimed',
  ASSIGNED: 'taskDetail.activityAssigned',
  UNASSIGNED: 'taskDetail.activityUnassigned',
  STATUS_CHANGED: 'taskDetail.activityStatusChanged',
  DUE_CHANGED: 'taskDetail.activityDueChanged',
  COMMENTED: 'taskDetail.activityCommented',
  DECIDED: 'taskDetail.activityDecided',
  REOPENED: 'taskDetail.activityReopened',
}

export interface TaskDetailData {
  id: string
  name: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  dueAt: Date | string | null
  assigneeId: string | null
  createdAt: Date | string
  completedAt: Date | string | null
  requiredRole: OrgRole | null
  kind: 'TASK' | 'APPROVAL'
  decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | null
  decisionNote: string | null
  approvalMode: 'ANY' | 'ALL' | null
  decisions: Array<{
    id: string
    userName: string
    decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'
    note: string | null
    createdAt: Date | string
  }>
  fields: WorkflowFormField[]
  formValues: Record<string, unknown> | null
  tags: string[]
  observerIds: string[]
  blockedBy: { id: string; name: string; status: string } | null
  siblings: Array<{ id: string; name: string }>
  instance: {
    id: string
    workflow: { id: string; name: string } | null
    version: { version: number }
    startedBy: { name: string }
  }
  createdBy: { name: string }
}

export interface CommentView {
  id: string
  body: string
  createdAt: Date | string
  author: { id: string; name: string }
}

export interface ActivityView {
  id: string
  type: ActivityType
  fromValue: string | null
  toValue: string | null
  createdAt: Date | string
  actor: { id: string; name: string } | null
}

export interface MemberView {
  userId: string
  user: { id: string; name: string }
}

function toDateInput(value: Date | string | null): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export function TaskDetail({
  task,
  comments,
  activities,
  members,
  currentUserId,
  canManage,
  canDecide,
}: {
  task: TaskDetailData
  comments: CommentView[]
  activities: ActivityView[]
  members: MemberView[]
  currentUserId: string
  canManage: boolean
  canDecide: boolean
}) {
  const router = useRouter()
  const t = useT()
  const { isPending, run } = useAction()
  const [comment, setComment] = useState('')
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [dueAt, setDueAt] = useState(toDateInput(task.dueAt))
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [formValues, setFormValues] = useState<Record<string, unknown>>(
    () => (task.formValues as Record<string, unknown> | null) ?? {}
  )
  const [tags, setTags] = useState(task.tags.join(', '))
  const [observers, setObservers] = useState<string[]>(task.observerIds)
  const [blockedBy, setBlockedBy] = useState<string>(task.blockedBy?.id ?? 'none')

  const isAssignee = task.assigneeId === currentUserId
  const canAct = isAssignee || canManage
  const isTerminal = task.status === 'DONE' || task.status === 'CANCELLED'

  const refresh = () => router.refresh()

  const claim = () =>
    run(() => claimTaskAction({ taskId: task.id }), {
      success: t('toast.taskClaimed'),
      onSuccess: refresh,
    })

  const transition = (to: TaskStatus, message: string) =>
    run(
      () =>
        transitionTaskAction({
          taskId: task.id,
          to,
          formValues: to === 'DONE' ? formValues : undefined,
        }),
      { success: message, onSuccess: refresh }
    )

  const assign = (assigneeId: string) =>
    run(() => assignTaskAction({ taskId: task.id, assigneeId: assigneeId === 'none' ? null : assigneeId }), {
      success: t('toast.assigneeUpdated'),
      onSuccess: refresh,
    })

  const saveAttributes = () =>
    run(
      () =>
        updateTaskAction({
          taskId: task.id,
          priority,
          dueAt: dueAt ? new Date(dueAt) : null,
          tags: tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          observerIds: observers,
          blockedByTaskId: blockedBy === 'none' ? null : blockedBy,
        }),
      { success: t('toast.updated'), onSuccess: refresh }
    )

  const reopen = () =>
    run(() => reopenTaskAction({ taskId: task.id }), {
      success: t('toast.taskReopened'),
      onSuccess: refresh,
    })

  const [decisionNote, setDecisionNote] = useState('')

  const decide = (decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED') =>
    run(
      () =>
        decideTaskAction({
          taskId: task.id,
          decision,
          note: decisionNote.trim() || undefined,
        }),
      {
        success: t('toast.decisionRecorded'),
        onSuccess: () => {
          setDecisionNote('')
          refresh()
        },
      }
    )

  const submitComment = () => {
    if (!comment.trim()) return
    run(() => addCommentAction({ taskId: task.id, body: comment }), {
      success: t('toast.commentPosted'),
      onSuccess: () => {
        setComment('')
        refresh()
      },
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{task.name}</CardTitle>
            <TaskStatusBadge status={task.status} />
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {task.description || t('taskDetail.noDescription')}
            </p>

            {task.fields.length > 0 && (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">
                  {task.kind === 'APPROVAL' ? t('taskDetail.decisionForm') : t('taskDetail.form')}
                </p>
                {task.fields.map((field) => (
                  <TaskFormField
                    key={field.key}
                    field={field}
                    value={formValues[field.key]}
                    disabled={!canAct || isTerminal}
                    onChange={(value) =>
                      setFormValues((prev) => ({ ...prev, [field.key]: value }))
                    }
                  />
                ))}
                {isTerminal && task.formValues && (
                  <p className="text-muted-foreground text-xs">{t('taskDetail.submittedValues')}</p>
                )}
              </div>
            )}

            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {task.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <Separator />
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">{t('table.workflow')}</p>
                <p className="font-medium">{task.instance.workflow?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('table.version')}</p>
                <p className="font-medium">v{task.instance.version.version}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('table.startedBy')}</p>
                <p className="font-medium">{task.instance.startedBy.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('table.created')}</p>
                <p className="font-medium">{formatDateTime(task.createdAt)}</p>
              </div>
            </div>

            {task.kind === 'APPROVAL' && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t('status.APPROVAL')}</p>
                  <Badge variant="outline">
                    {task.approvalMode === 'ALL'
                      ? t('taskDetail.allApprovers')
                      : t('taskDetail.anyApprover')}
                  </Badge>
                </div>

                {task.decisions.length > 0 && (
                  <div className="space-y-2">
                    {task.decisions.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-2 text-sm">
                        <Badge variant={decisionVariant(entry.decision)}>
                          {t(`status.${entry.decision}` as MessageKey)}
                        </Badge>
                        <div className="min-w-0">
                          <p className="font-medium">{entry.userName}</p>
                          {entry.note && <p className="text-muted-foreground">{entry.note}</p>}
                          <p className="text-muted-foreground text-xs">
                            {formatRelativeTime(entry.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isTerminal ? (
                  <p className="text-muted-foreground text-sm">
                    {t('taskDetail.resolved', {
                      decision: task.decision
                        ? t(`status.${task.decision}` as MessageKey)
                        : '—',
                    })}
                    {task.decisionNote ? ` — ${task.decisionNote}` : ''}
                  </p>
                ) : canDecide ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="decision-note">{t('taskDetail.noteOptional')}</Label>
                      <Textarea
                        id="decision-note"
                        value={decisionNote}
                        onChange={(event) => setDecisionNote(event.target.value)}
                        disabled={isPending}
                        placeholder={t('taskDetail.notePlaceholder')}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => decide('APPROVED')} disabled={isPending}>
                        {isPending ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />}
                        {t('taskDetail.approve')}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => decide('CHANGES_REQUESTED')}
                        disabled={isPending}
                      >
                        <RotateCcwIcon />
                        {t('taskDetail.requestChanges')}
                      </Button>
                      <Button
                        variant="outline"
                        className="text-destructive"
                        onClick={() => decide('REJECTED')}
                        disabled={isPending}
                      >
                        <XIcon />
                        {t('taskDetail.reject')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">{t('taskDetail.notEligible')}</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {task.kind === 'TASK' && task.status === 'PENDING' && !task.assigneeId && (
                <Button onClick={claim} disabled={isPending}>
                  {isPending ? <Loader2Icon className="animate-spin" /> : <HandIcon />}
                  {t('taskDetail.claim')}
                </Button>
              )}
              {task.kind === 'TASK' && task.status === 'CLAIMED' && isAssignee && (
                <Button
                  onClick={() => transition('IN_PROGRESS', t('taskDetail.started'))}
                  disabled={isPending}
                >
                  <PlayIcon />
                  {t('taskDetail.startWorking')}
                </Button>
              )}
              {task.kind === 'TASK' && task.status === 'IN_PROGRESS' && isAssignee && (
                <Button
                  onClick={() => transition('DONE', t('toast.taskCompleted'))}
                  disabled={isPending}
                >
                  <CheckCircle2Icon />
                  {t('taskDetail.complete')}
                </Button>
              )}
              {task.kind === 'TASK' &&
                (task.status === 'CLAIMED' || task.status === 'IN_PROGRESS') &&
                isAssignee && (
                  <Button
                    variant="outline"
                    onClick={() => transition('PENDING', t('taskDetail.released'))}
                    disabled={isPending}
                  >
                    <RotateCcwIcon />
                    {t('taskDetail.release')}
                  </Button>
                )}
              {canManage && !isTerminal && (
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setConfirmCancel(true)}
                  disabled={isPending}
                >
                  <XIcon />
                  {t('taskDetail.cancel')}
                </Button>
              )}
              {task.status === 'DONE' && (canManage || isAssignee) && (
                <Button variant="outline" onClick={reopen} disabled={isPending}>
                  <RotateCcwIcon />
                  {t('taskDetail.reopen')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('taskDetail.comments')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('taskDetail.noComments')}</p>
            ) : (
              <div className="space-y-4">
                {comments.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                      {item.author.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{item.author.name}</span>{' '}
                        <span className="text-muted-foreground text-xs">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </p>
                      <p className="text-sm break-words whitespace-pre-wrap">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="comment">{t('taskDetail.addComment')}</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={t('taskDetail.commentPlaceholder')}
                disabled={isPending}
              />
              <div className="flex justify-end">
                <Button onClick={submitComment} disabled={isPending || !comment.trim()} size="sm">
                  {isPending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
                  {t('taskDetail.comment')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('taskDetail.attributes')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {task.kind === 'TASK' && (
              <div className="space-y-2">
                <Label htmlFor="task-assignee">{t('table.assignee')}</Label>
                {canManage ? (
                  <Select value={task.assigneeId ?? 'none'} onValueChange={assign} disabled={isPending}>
                    <SelectTrigger id="task-assignee" className="w-full">
                      <SelectValue placeholder={t('table.unassigned')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('table.unassigned')}</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.userId} value={member.userId}>
                          {member.user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm">
                    {members.find((m) => m.userId === task.assigneeId)?.user.name ??
                      t('table.unassigned')}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="task-priority">{t('table.priority')}</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as TaskPriority)}
                disabled={!canAct || isPending}
              >
                <SelectTrigger id="task-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_KEY) as TaskPriority[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(PRIORITY_KEY[value])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due-date">{t('taskDetail.dueDate')}</Label>
              <Input
                id="due-date"
                type="date"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                disabled={!canAct || isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-tags">{t('taskDetail.tags')}</Label>
              <Input
                id="task-tags"
                value={tags}
                autoComplete="off"
                placeholder={t('taskDetail.tagsPlaceholder')}
                onChange={(event) => setTags(event.target.value)}
                disabled={!canAct || isPending}
              />
              <p className="text-muted-foreground text-xs">{t('taskDetail.commaSeparated')}</p>
            </div>

            {task.siblings.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="task-blocked-by">{t('taskDetail.blockedBy')}</Label>
                <Select value={blockedBy} onValueChange={setBlockedBy} disabled={!canAct || isPending}>
                  <SelectTrigger id="task-blocked-by" className="w-full">
                    <SelectValue placeholder={t('taskDetail.nothing')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('taskDetail.nothing')}</SelectItem>
                    {task.siblings.map((sibling) => (
                      <SelectItem key={sibling.id} value={sibling.id}>
                        {sibling.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {task.blockedBy && task.blockedBy.status !== 'DONE' && (
                  <p className="text-destructive text-xs">
                    {t('taskDetail.waitingOn', { name: task.blockedBy.name })}
                  </p>
                )}
              </div>
            )}

            {members.length > 1 && (
              <div className="space-y-2">
                <Label>{t('taskDetail.observers')}</Label>
                <div className="border-border max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
                  {members
                    .filter((member) => member.userId !== task.assigneeId)
                    .map((member) => (
                      <label key={member.userId} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={observers.includes(member.userId)}
                          disabled={!canAct || isPending}
                          onCheckedChange={(checked) =>
                            setObservers((prev) =>
                              checked === true
                                ? [...prev, member.userId]
                                : prev.filter((id) => id !== member.userId)
                            )
                          }
                        />
                        {member.user.name}
                      </label>
                    ))}
                </div>
              </div>
            )}

            <Button
              className="w-full"
              onClick={saveAttributes}
              disabled={!canAct || isPending}
              variant="outline"
            >
              {t('taskDetail.saveAttributes')}
            </Button>

            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('table.priority')}</span>
              <TaskPriorityBadge priority={task.priority} />
            </div>
            {task.requiredRole && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('taskDetail.requiredRole')}</span>
                <span className="font-medium">{task.requiredRole}+</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('taskDetail.activity')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('taskDetail.noActivity')}</p>
            ) : (
              activities.map((item) => (
                <div key={item.id} className="flex gap-3 text-sm">
                  <div className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
                  <div className="min-w-0">
                    <p>
                      <span className="font-medium">{item.actor?.name ?? t('app.system')}</span>{' '}
                      <span className="text-muted-foreground">{t(ACTIVITY_KEY[item.type])}</span>
                      {item.type === 'STATUS_CHANGED' && item.fromValue && item.toValue && (
                        <span className="text-muted-foreground">
                          {' '}
                          {item.fromValue} → {item.toValue}
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </aside>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('taskDetail.cancelConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('taskDetail.cancelConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('taskDetail.keepTask')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                setConfirmCancel(false)
                transition('CANCELLED', t('toast.taskCancelled'))
              }}
            >
              {t('taskDetail.cancelTask')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function decisionVariant(
  decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'
): 'default' | 'destructive' | 'secondary' {
  if (decision === 'APPROVED') return 'default'
  if (decision === 'REJECTED') return 'destructive'
  return 'secondary'
}

function TaskFormField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: WorkflowFormField
  value: unknown
  onChange: (value: unknown) => void
  disabled: boolean
}) {
  const t = useT()
  const id = `field-${field.key}`
  const label = (
    <>
      {field.label}
      {field.required && <span className="text-destructive"> *</span>}
    </>
  )

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
          disabled={disabled}
        />
        {label}
      </label>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {field.type === 'textarea' ? (
        <Textarea
          id={id}
          disabled={disabled}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.type === 'select' ? (
        <Select
          value={String(value ?? '')}
          onValueChange={(next) => onChange(next)}
          disabled={disabled}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder={t('taskDetail.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === 'number' ? (
        <Input
          id={id}
          type="number"
          min={field.min}
          max={field.max}
          disabled={disabled}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(event) =>
            onChange(event.target.value === '' ? '' : Number(event.target.value))
          }
        />
      ) : (
        <Input
          id={id}
          type={field.type === 'date' ? 'date' : 'text'}
          disabled={disabled}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  )
}
