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
import { PRIORITY_LABEL, TaskPriorityBadge, TaskStatusBadge } from './task-badges'
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

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  CREATED: 'created this task',
  CLAIMED: 'claimed this task',
  ASSIGNED: 'assigned this task',
  UNASSIGNED: 'unassigned this task',
  STATUS_CHANGED: 'changed the status',
  DUE_CHANGED: 'changed the due date',
  COMMENTED: 'commented',
  DECIDED: 'made a decision on',
  REOPENED: 'reopened',
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
    run(() => claimTaskAction({ taskId: task.id }), { success: 'Task claimed', onSuccess: refresh })

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
      success: 'Assignment updated',
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
      { success: 'Task updated', onSuccess: refresh }
    )

  const reopen = () =>
    run(() => reopenTaskAction({ taskId: task.id }), { success: 'Task reopened', onSuccess: refresh })

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
        success: 'Decision recorded',
        onSuccess: () => {
          setDecisionNote('')
          refresh()
        },
      }
    )

  const submitComment = () => {
    if (!comment.trim()) return
    run(() => addCommentAction({ taskId: task.id, body: comment }), {
      success: 'Comment added',
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
              {task.description || 'No description provided.'}
            </p>

            {task.fields.length > 0 && (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">
                  {task.kind === 'APPROVAL' ? 'Decision form' : 'Form'}
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
                  <p className="text-muted-foreground text-xs">Submitted values are shown above.</p>
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
                <p className="text-muted-foreground">Workflow</p>
                <p className="font-medium">{task.instance.workflow?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Version</p>
                <p className="font-medium">v{task.instance.version.version}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Started by</p>
                <p className="font-medium">{task.instance.startedBy.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{formatDateTime(task.createdAt)}</p>
              </div>
            </div>

            {task.kind === 'APPROVAL' && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Approval</p>
                  <Badge variant="outline">
                    {task.approvalMode === 'ALL' ? 'All approvers required' : 'Any approver'}
                  </Badge>
                </div>

                {task.decisions.length > 0 && (
                  <div className="space-y-2">
                    {task.decisions.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-2 text-sm">
                        <Badge variant={decisionVariant(entry.decision)}>{entry.decision}</Badge>
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
                    Resolved: {task.decision ?? '—'}
                    {task.decisionNote ? ` — ${task.decisionNote}` : ''}
                  </p>
                ) : canDecide ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="decision-note">Note (optional)</Label>
                      <Textarea
                        id="decision-note"
                        value={decisionNote}
                        onChange={(event) => setDecisionNote(event.target.value)}
                        disabled={isPending}
                        placeholder="Reason for your decision"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => decide('APPROVED')} disabled={isPending}>
                        {isPending ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />}
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => decide('CHANGES_REQUESTED')}
                        disabled={isPending}
                      >
                        <RotateCcwIcon />
                        Request changes
                      </Button>
                      <Button
                        variant="outline"
                        className="text-destructive"
                        onClick={() => decide('REJECTED')}
                        disabled={isPending}
                      >
                        <XIcon />
                        Reject
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    You are not eligible to decide this approval.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {task.kind === 'TASK' && task.status === 'PENDING' && !task.assigneeId && (
                <Button onClick={claim} disabled={isPending}>
                  {isPending ? <Loader2Icon className="animate-spin" /> : <HandIcon />}
                  Claim task
                </Button>
              )}
              {task.kind === 'TASK' && task.status === 'CLAIMED' && isAssignee && (
                <Button
                  onClick={() => transition('IN_PROGRESS', 'Task started')}
                  disabled={isPending}
                >
                  <PlayIcon />
                  Start working
                </Button>
              )}
              {task.kind === 'TASK' && task.status === 'IN_PROGRESS' && isAssignee && (
                <Button
                  onClick={() => transition('DONE', 'Task completed')}
                  disabled={isPending}
                >
                  <CheckCircle2Icon />
                  Complete
                </Button>
              )}
              {task.kind === 'TASK' &&
                (task.status === 'CLAIMED' || task.status === 'IN_PROGRESS') &&
                isAssignee && (
                  <Button
                    variant="outline"
                    onClick={() => transition('PENDING', 'Task released')}
                    disabled={isPending}
                  >
                    <RotateCcwIcon />
                    Release
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
                  Cancel
                </Button>
              )}
              {task.status === 'DONE' && (canManage || isAssignee) && (
                <Button variant="outline" onClick={reopen} disabled={isPending}>
                  <RotateCcwIcon />
                  Reopen
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No comments yet.</p>
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
              <Label htmlFor="comment">Add a comment</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Write an update..."
                disabled={isPending}
              />
              <div className="flex justify-end">
                <Button onClick={submitComment} disabled={isPending || !comment.trim()} size="sm">
                  {isPending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
                  Comment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Attributes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {task.kind === 'TASK' && (
              <div className="space-y-2">
                <Label htmlFor="task-assignee">Assignee</Label>
                {canManage ? (
                  <Select value={task.assigneeId ?? 'none'} onValueChange={assign} disabled={isPending}>
                    <SelectTrigger id="task-assignee" className="w-full">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.userId} value={member.userId}>
                          {member.user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm">
                    {members.find((m) => m.userId === task.assigneeId)?.user.name ?? 'Unassigned'}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as TaskPriority)}
                disabled={!canAct || isPending}
              >
                <SelectTrigger id="task-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {PRIORITY_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due-date">Due date</Label>
              <Input
                id="due-date"
                type="date"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                disabled={!canAct || isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-tags">Tags</Label>
              <Input
                id="task-tags"
                value={tags}
                autoComplete="off"
                placeholder="urgent, finance"
                onChange={(event) => setTags(event.target.value)}
                disabled={!canAct || isPending}
              />
              <p className="text-muted-foreground text-xs">Comma separated.</p>
            </div>

            {task.siblings.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="task-blocked-by">Blocked by</Label>
                <Select value={blockedBy} onValueChange={setBlockedBy} disabled={!canAct || isPending}>
                  <SelectTrigger id="task-blocked-by" className="w-full">
                    <SelectValue placeholder="Nothing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nothing</SelectItem>
                    {task.siblings.map((sibling) => (
                      <SelectItem key={sibling.id} value={sibling.id}>
                        {sibling.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {task.blockedBy && task.blockedBy.status !== 'DONE' && (
                  <p className="text-destructive text-xs">
                    Waiting on “{task.blockedBy.name}” before this task can be claimed.
                  </p>
                )}
              </div>
            )}

            {members.length > 1 && (
              <div className="space-y-2">
                <Label>Observers</Label>
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
              Save attributes
            </Button>

            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Priority</span>
              <TaskPriorityBadge priority={task.priority} />
            </div>
            {task.requiredRole && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Required role</span>
                <span className="font-medium">{task.requiredRole}+</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-muted-foreground text-sm">No activity yet.</p>
            ) : (
              activities.map((item) => (
                <div key={item.id} className="flex gap-3 text-sm">
                  <div className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
                  <div className="min-w-0">
                    <p>
                      <span className="font-medium">{item.actor?.name ?? 'System'}</span>{' '}
                      <span className="text-muted-foreground">{ACTIVITY_LABEL[item.type]}</span>
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
            <AlertDialogTitle>Cancel this task?</AlertDialogTitle>
            <AlertDialogDescription>
              The task will be marked as cancelled and cannot be reopened.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep task</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                setConfirmCancel(false)
                transition('CANCELLED', 'Task cancelled')
              }}
            >
              Cancel task
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
            <SelectValue placeholder="Select…" />
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
