import { invalid } from '@/shared/server/errors'
import type { WorkflowStepInput } from '../schemas/workflowSchema'

export interface SnapshotStep {
  order: number
  name: string
  description: string | null
  assigneeRole: 'OWNER' | 'ADMIN' | 'MEMBER' | null
  dueInDays: number | null
}

/**
 * Produces the immutable snapshot persisted in `WorkflowVersion.steps` at
 * publish time. Order is normalized to 1..n regardless of the input order.
 */
export function buildStepSnapshot(steps: WorkflowStepInput[]): SnapshotStep[] {
  return steps.map((step, index) => ({
    order: index + 1,
    name: step.name.trim(),
    description: step.description?.trim() ? step.description.trim() : null,
    assigneeRole: step.assigneeRole ?? null,
    dueInDays: step.dueInDays ?? null,
  }))
}

/**
 * Validates a draft before it may be published. Returns the normalized snapshot
 * or throws a validation error describing the first problem found.
 */
export function validateForPublish(steps: WorkflowStepInput[]): SnapshotStep[] {
  if (!steps || steps.length === 0) {
    throw invalid('Add at least one step before publishing')
  }

  const snapshot = buildStepSnapshot(steps)

  const seen = new Set<string>()
  for (const step of snapshot) {
    const key = step.name.trim().toLowerCase()
    if (key.length === 0) {
      throw invalid('Every step needs a name')
    }
    if (seen.has(key)) {
      throw invalid(`Duplicate step name: "${step.name}"`)
    }
    seen.add(key)
    if (step.dueInDays !== null && step.dueInDays < 0) {
      throw invalid('Due dates cannot be negative')
    }
  }

  return snapshot
}
