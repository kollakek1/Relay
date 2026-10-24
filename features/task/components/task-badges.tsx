'use client'

import type { TaskPriority, TaskStatus } from '@/prisma/generated/prisma/enums'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'
import { useT } from '@/shared/i18n/provider'
import type { MessageKey } from '@/shared/i18n/translate'

const STATUS_KEY: Record<TaskStatus, MessageKey> = {
  BLOCKED: 'status.BLOCKED',
  PENDING: 'status.PENDING',
  CLAIMED: 'status.CLAIMED',
  IN_PROGRESS: 'status.IN_PROGRESS',
  DONE: 'status.DONE',
  CANCELLED: 'status.CANCELLED',
}

export { STATUS_KEY }

const STATUS_CLASS: Record<TaskStatus, string> = {
  BLOCKED: 'bg-muted text-muted-foreground',
  PENDING: 'bg-secondary text-secondary-foreground',
  CLAIMED: 'bg-primary/15 text-primary',
  IN_PROGRESS: 'bg-primary text-primary-foreground',
  DONE: 'bg-emerald-500/15 text-emerald-500',
  CANCELLED: 'bg-destructive/10 text-destructive',
}

/** Localised, colour-independent status badge (the label always carries meaning). */
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const t = useT()
  return (
    <Badge className={cn('border-transparent', STATUS_CLASS[status])}>{t(STATUS_KEY[status])}</Badge>
  )
}

const PRIORITY_KEY: Record<TaskPriority, MessageKey> = {
  LOW: 'status.LOW',
  MEDIUM: 'status.MEDIUM',
  HIGH: 'status.HIGH',
  URGENT: 'status.URGENT',
}

export { PRIORITY_KEY }

const PRIORITY_CLASS: Record<TaskPriority, string> = {
  LOW: 'text-muted-foreground',
  MEDIUM: 'text-foreground',
  HIGH: 'text-orange-500',
  URGENT: 'text-destructive',
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  const t = useT()
  return (
    <span className={cn('text-xs font-medium uppercase', PRIORITY_CLASS[priority])}>
      {t(PRIORITY_KEY[priority])}
    </span>
  )
}