import { invalid } from '@/shared/server/errors'
import type { WorkflowStepInput } from '../schemas/workflowSchema'
import type { ProcessSnapshotStep } from './engine'

/**
 * Produces the immutable snapshot persisted in `WorkflowVersion.steps` at
 * publish time. Order is normalized to 1..n regardless of the input order.
 */
export function buildStepSnapshot(steps: WorkflowStepInput[]): ProcessSnapshotStep[] {
  return steps.map((step, index) => ({
    order: index + 1,
    name: step.name.trim(),
    description: step.description?.trim() ? step.description.trim() : null,
    assigneeRole: step.assigneeRole ?? null,
    dueInDays: step.dueInDays ?? null,
    kind: step.kind ?? 'TASK',
    approvalMode:
      step.kind === 'APPROVAL' ? (step.approvalMode ?? 'ANY') : null,
    fields: step.fields ?? [],
    condition: step.condition ?? null,
  }))
}

/**
 * Validates a draft before it may be published and returns the normalized
 * snapshot. A condition may only reference a form field defined by an *earlier*
 * step, which guarantees conditions are always resolvable at runtime.
 */
export function validateForPublish(steps: WorkflowStepInput[]): ProcessSnapshotStep[] {
  if (!steps || steps.length === 0) {
    throw invalid('Add at least one step before publishing')
  }

  const snapshot = buildStepSnapshot(steps)
  const seenNames = new Set<string>()
  const availableVariables = new Set<string>()

  for (const step of snapshot) {
    const nameKey = step.name.trim().toLowerCase()
    if (nameKey.length === 0) throw invalid('Every step needs a name')
    if (seenNames.has(nameKey)) throw invalid(`Duplicate step name: "${step.name}"`)
    seenNames.add(nameKey)

    if (step.dueInDays !== null && step.dueInDays < 0) {
      throw invalid('Due dates cannot be negative')
    }

    const fieldKeys = new Set<string>()
    for (const field of step.fields) {
      if (!field.key) throw invalid(`Step "${step.name}" has a form field without a key`)
      if (fieldKeys.has(field.key)) {
        throw invalid(`Step "${step.name}" has a duplicate field key "${field.key}"`)
      }
      fieldKeys.add(field.key)
      if (field.type === 'select' && (!field.options || field.options.length === 0)) {
        throw invalid(`Field "${field.label}" is a select but has no options`)
      }
    }

    if (step.condition && !availableVariables.has(step.condition.field)) {
      throw invalid(
        `Step "${step.name}" condition references "${step.condition.field}", which no earlier step collects`
      )
    }

    for (const field of step.fields) availableVariables.add(field.key)
  }

  return snapshot
}
