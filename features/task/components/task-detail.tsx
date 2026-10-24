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
  transitionTaskAction,
  updateTaskAction,
} from '@/features/task/actions'
import { PRIORITY_LABEL, TaskPriorityBadge, TaskStatusBadge } from './task-badges'
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
}: {
  task: TaskDetailData
  comments: CommentView[]
  activities: ActivityView[]
  members: MemberView[]
  currentUserId: string
  canManage: boolean
}) {
  const router = useRouter()
  const { isPending, run } = useAction()
  const [comment, setComment] = useState('')
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [dueAt, setDueAt] = useState(toDateInput(task.dueAt))
  const [confirmCancel, setConfirmCancel] = useState(false)

  const isAssignee = task.assigneeId === currentUserId
  const canAct = isAssignee || canManage
  const isTerminal = task.status === 'DONE' || task.status === 'CANCELLED'

  const refresh = () => router.refresh()

  const claim = () =>
    run(() => claimTaskAction({ taskId: task.id }), { success: 'Task claimed', onSuccess: refresh })

  const transition = (to: TaskStatus, message: string) =>
    run(() => transitionTaskAction({ taskId: task.id, to }), { success: message, onSuccess: refresh })

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
        }),
      { success: 'Task updated', onSuccess: refresh }
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

            <div className="flex flex-wrap gap-2 pt-2">
              {task.status === 'PENDING' && !task.assigneeId && (
                <Button onClick={claim} disabled={isPending}>
                  {isPending ? <Loader2Icon className="animate-spin" /> : <HandIcon />}
                  Claim task
                </Button>
              )}
              {task.status === 'CLAIMED' && isAssignee && (
                <Button
                  onClick={() => transition('IN_PROGRESS', 'Task started')}
                  disabled={isPending}
                >
                  <PlayIcon />
                  Start working
                </Button>
              )}
              {task.status === 'IN_PROGRESS' && isAssignee && (
                <Button
                  onClick={() => transition('DONE', 'Task completed')}
                  disabled={isPending}
                >
                  <CheckCircle2Icon />
                  Complete
                </Button>
              )}
              {(task.status === 'CLAIMED' || task.status === 'IN_PROGRESS') && isAssignee && (
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
