import type { TaskPriority, TaskStatus } from '@/prisma/generated/prisma/enums'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'

const STATUS_LABEL: Record<TaskStatus, string> = {
  BLOCKED: 'Blocked',
  PENDING: 'Available',
  CLAIMED: 'Claimed',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
}

const STATUS_CLASS: Record<TaskStatus, string> = {
  BLOCKED: 'bg-muted text-muted-foreground',
  PENDING: 'bg-secondary text-secondary-foreground',
  CLAIMED: 'bg-primary/15 text-primary',
  IN_PROGRESS: 'bg-primary text-primary-foreground',
  DONE: 'bg-emerald-500/15 text-emerald-500',
  CANCELLED: 'bg-destructive/10 text-destructive',
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge className={cn('border-transparent', STATUS_CLASS[status])}>{STATUS_LABEL[status]}</Badge>
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
}

const PRIORITY_CLASS: Record<TaskPriority, string> = {
  LOW: 'text-muted-foreground',
  MEDIUM: 'text-foreground',
  HIGH: 'text-orange-500',
  URGENT: 'text-destructive',
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={cn('text-xs font-medium uppercase', PRIORITY_CLASS[priority])}>
      {PRIORITY_LABEL[priority]}
    </span>
  )
}

export { STATUS_LABEL, PRIORITY_LABEL }
