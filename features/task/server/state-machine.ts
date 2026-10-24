import type { TaskStatus } from '@/prisma/generated/prisma/enums'

/**
 * Allowed task status transitions. The state machine is defined once here and
 * enforced on the server for every mutation, so a malicious client cannot jump
 * a task straight to `DONE`.
 *
 *  BLOCKED ──▶ PENDING ──▶ CLAIMED ⇄ IN_PROGRESS ──▶ DONE
 *     │            │          │           │
 *     └────────────┴──────────┴───────────┴──▶ CANCELLED
 */
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  BLOCKED: ['PENDING', 'CANCELLED'],
  PENDING: ['CLAIMED', 'CANCELLED'],
  CLAIMED: ['IN_PROGRESS', 'PENDING', 'CANCELLED'],
  IN_PROGRESS: ['DONE', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from]?.includes(to) ?? false
}

/** Statuses that count as "open work" for a user. */
export const ACTIVE_TASK_STATUSES: TaskStatus[] = ['BLOCKED', 'PENDING', 'CLAIMED', 'IN_PROGRESS']

/** Statuses that can be edited / transitioned by their owner. */
export const TERMINAL_TASK_STATUSES: TaskStatus[] = ['DONE', 'CANCELLED']

export function isTerminal(status: TaskStatus): boolean {
  return TERMINAL_TASK_STATUSES.includes(status)
}
