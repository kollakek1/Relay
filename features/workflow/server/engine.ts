import type { OrgRole, StepKind } from '@/prisma/generated/prisma/enums'

export type FormFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox'

export interface WorkflowFormField {
  key: string
  label: string
  type: FormFieldType
  required?: boolean
  options?: string[]
  min?: number
  max?: number
}

export type ConditionOp = 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'isTrue' | 'isFalse'

export interface StepCondition {
  field: string
  op: ConditionOp
  value?: string | number | boolean
}

export interface ProcessSnapshotStep {
  order: number
  name: string
  description: string | null
  assigneeRole: OrgRole | null
  dueInDays: number | null
  kind: StepKind
  fields: WorkflowFormField[]
  /** `null` means "always run"; otherwise the step runs only if the condition holds. */
  condition: StepCondition | null
}

export interface ProcessSnapshot {
  schemaVersion: 2
  steps: ProcessSnapshotStep[]
}

const FIELD_TYPES: FormFieldType[] = ['text', 'textarea', 'number', 'date', 'select', 'checkbox']
const OPS: ConditionOp[] = ['eq', 'neq', 'gt', 'lt', 'contains', 'isTrue', 'isFalse']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeFields(value: unknown): WorkflowFormField[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((raw) => ({
    key: String(raw.key ?? ''),
    label: String(raw.label ?? raw.key ?? ''),
    type: FIELD_TYPES.includes(raw.type as FormFieldType) ? (raw.type as FormFieldType) : 'text',
    required: Boolean(raw.required),
    options: Array.isArray(raw.options) ? raw.options.map((option) => String(option)) : undefined,
    min: typeof raw.min === 'number' ? raw.min : undefined,
    max: typeof raw.max === 'number' ? raw.max : undefined,
  }))
}

function toCondition(value: unknown): StepCondition | null {
  if (!isRecord(value) || typeof value.field !== 'string') return null
  const op = OPS.includes(value.op as ConditionOp) ? (value.op as ConditionOp) : 'eq'
  return { field: value.field, op, value: value.value as string | number | boolean | undefined }
}

function toStep(raw: unknown, index: number): ProcessSnapshotStep {
  const step = isRecord(raw) ? raw : {}
  return {
    order: typeof step.order === 'number' ? step.order : index + 1,
    name: String(step.name ?? `Step ${index + 1}`),
    description: typeof step.description === 'string' ? step.description : null,
    assigneeRole: (step.assigneeRole as OrgRole | null) ?? null,
    dueInDays: typeof step.dueInDays === 'number' ? step.dueInDays : null,
    kind: step.kind === 'APPROVAL' ? 'APPROVAL' : 'TASK',
    fields: normalizeFields(step.fields),
    condition: toCondition(step.condition),
  }
}

/**
 * Normalizes a stored `WorkflowVersion.steps` value. Versions published before
 * V2 are plain arrays (linear, no forms/conditions) and must keep running — this
 * upgrades them in memory without touching the stored snapshot.
 */
export function normalizeSnapshot(input: unknown): ProcessSnapshot {
  if (Array.isArray(input)) {
    return { schemaVersion: 2, steps: input.map((raw, index) => toStep(raw, index)) }
  }
  const steps = isRecord(input) && Array.isArray(input.steps) ? input.steps : []
  return { schemaVersion: 2, steps: steps.map((raw, index) => toStep(raw, index)) }
}

/** Merges the form values of completed tasks into a flat variable map. */
export function collectVariables(tasks: Array<{ formValues: unknown }>): Record<string, unknown> {
  const variables: Record<string, unknown> = {}
  for (const task of tasks) {
    if (isRecord(task.formValues)) Object.assign(variables, task.formValues)
  }
  return variables
}

/** Evaluates a skip condition against collected variables. No condition → run. */
export function evaluateCondition(
  condition: StepCondition | null | undefined,
  variables: Record<string, unknown>
): boolean {
  if (!condition || !condition.field) return true
  const raw = variables[condition.field]
  switch (condition.op) {
    case 'isTrue':
      return raw === true || raw === 'true'
    case 'isFalse':
      return !(raw === true || raw === 'true')
    case 'eq':
      return String(raw ?? '') === String(condition.value ?? '')
    case 'neq':
      return String(raw ?? '') !== String(condition.value ?? '')
    case 'contains':
      return String(raw ?? '')
        .toLowerCase()
        .includes(String(condition.value ?? '').toLowerCase())
    case 'gt':
      return Number(raw) > Number(condition.value)
    case 'lt':
      return Number(raw) < Number(condition.value)
    default:
      return true
  }
}

export type FormValidation =
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; errors: string[] }

/**
 * Validates and normalizes submitted form values against the frozen field
 * definitions. Runs on the server only — the client cannot change the shape of a
 * published form.
 */
export function validateFormValues(
  fields: WorkflowFormField[],
  input: unknown
): FormValidation {
  const raw = isRecord(input) ? input : {}
  const values: Record<string, unknown> = {}
  const errors: string[] = []

  for (const field of fields) {
    if (!field.key) continue
    let value: unknown = raw[field.key]

    switch (field.type) {
      case 'number': {
        if (value === '' || value === null || value === undefined) {
          value = undefined
          break
        }
        const num = Number(value)
        if (Number.isNaN(num)) {
          errors.push(`${field.label} must be a number`)
          continue
        }
        if (field.min !== undefined && num < field.min) {
          errors.push(`${field.label} must be at least ${field.min}`)
        }
        if (field.max !== undefined && num > field.max) {
          errors.push(`${field.label} must be at most ${field.max}`)
        }
        value = num
        break
      }
      case 'checkbox': {
        value = value === true || value === 'true' || value === 'on'
        break
      }
      case 'select': {
        const text = value === null || value === undefined ? '' : String(value)
        if (text && field.options && !field.options.includes(text)) {
          errors.push(`${field.label} has an invalid option`)
          continue
        }
        value = text
        break
      }
      default: {
        value = value === null || value === undefined ? '' : String(value)
      }
    }

    const isEmpty =
      value === undefined || value === '' || (field.type === 'checkbox' && value === false)

    if (field.required && isEmpty) {
      errors.push(`${field.label} is required`)
      continue
    }
    if (!isEmpty) values[field.key] = value
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, values }
}

/** Fields required to complete a task (a step with fields must be submitted). */
export function hasRequiredFields(fields: WorkflowFormField[]): boolean {
  return fields.length > 0
}
