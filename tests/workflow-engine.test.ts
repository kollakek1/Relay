import { describe, expect, it } from 'vitest'
import {
  evaluateCondition,
  normalizeFields,
  normalizeSnapshot,
  validateFormValues,
  type WorkflowFormField,
} from '@/features/workflow/server/engine'

describe('condition evaluation', () => {
  const variables = { priority: 'high', amount: 1200, approved: true, note: 'urgent request' }

  it('treats a missing condition as "always run"', () => {
    expect(evaluateCondition(null, variables)).toBe(true)
    expect(evaluateCondition(undefined, variables)).toBe(true)
  })

  it('supports eq / neq', () => {
    expect(evaluateCondition({ field: 'priority', op: 'eq', value: 'high' }, variables)).toBe(true)
    expect(evaluateCondition({ field: 'priority', op: 'eq', value: 'low' }, variables)).toBe(false)
    expect(evaluateCondition({ field: 'priority', op: 'neq', value: 'low' }, variables)).toBe(true)
  })

  it('supports gt / lt numerically', () => {
    expect(evaluateCondition({ field: 'amount', op: 'gt', value: 1000 }, variables)).toBe(true)
    expect(evaluateCondition({ field: 'amount', op: 'lt', value: 1000 }, variables)).toBe(false)
  })

  it('supports contains (case-insensitive)', () => {
    expect(evaluateCondition({ field: 'note', op: 'contains', value: 'URGENT' }, variables)).toBe(true)
    expect(evaluateCondition({ field: 'note', op: 'contains', value: 'calm' }, variables)).toBe(false)
  })

  it('supports isTrue / isFalse', () => {
    expect(evaluateCondition({ field: 'approved', op: 'isTrue' }, variables)).toBe(true)
    expect(evaluateCondition({ field: 'priority', op: 'isFalse' }, variables)).toBe(true)
    expect(evaluateCondition({ field: 'approved', op: 'isFalse' }, variables)).toBe(false)
  })

  it('resolves missing variables without throwing', () => {
    expect(evaluateCondition({ field: 'missing', op: 'gt', value: 1 }, variables)).toBe(false)
    expect(evaluateCondition({ field: 'missing', op: 'eq', value: 'x' }, variables)).toBe(false)
  })
})

describe('form value validation', () => {
  const fields: WorkflowFormField[] = [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'amount', label: 'Amount', type: 'number', min: 10, max: 1000 },
    { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'high'] },
    { key: 'urgent', label: 'Urgent', type: 'checkbox' },
  ]

  it('rejects a missing required field', () => {
    const result = validateFormValues(fields, { amount: 100 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/Title/)
  })

  it('coerces and bounds numbers', () => {
    const tooLow = validateFormValues(fields, { title: 'x', amount: 5 })
    expect(tooLow.ok).toBe(false)

    const tooHigh = validateFormValues(fields, { title: 'x', amount: 5000 })
    expect(tooHigh.ok).toBe(false)

    const ok = validateFormValues(fields, { title: 'x', amount: '250' })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.values.amount).toBe(250)
  })

  it('rejects an invalid select option', () => {
    const result = validateFormValues(fields, { title: 'x', priority: 'medium' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/invalid option/)
  })

  it('normalizes checkboxes and drops empty optional values', () => {
    const result = validateFormValues(fields, { title: 'x', urgent: 'on', amount: '' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.values.urgent).toBe(true)
      expect(result.values.amount).toBeUndefined()
    }
  })
})

describe('snapshot normalization', () => {
  it('upgrades a legacy array snapshot (v1) to the v2 shape', () => {
    const legacy = [
      { order: 1, name: 'Draft', description: 'd', assigneeRole: 'ADMIN', dueInDays: 2 },
    ]
    const snapshot = normalizeSnapshot(legacy)
    expect(snapshot.schemaVersion).toBe(2)
    expect(snapshot.steps[0]).toMatchObject({
      name: 'Draft',
      kind: 'TASK',
      fields: [],
      condition: null,
    })
  })

  it('reads a v2 snapshot unchanged', () => {
    const snapshot = normalizeSnapshot({
      schemaVersion: 2,
      steps: [{ order: 1, name: 'A', kind: 'APPROVAL', fields: [{ key: 'k', label: 'K', type: 'text' }], condition: { field: 'k', op: 'eq', value: 'y' } }],
    })
    expect(snapshot.steps[0].kind).toBe('APPROVAL')
    expect(snapshot.steps[0].fields).toHaveLength(1)
    expect(snapshot.steps[0].condition).toEqual({ field: 'k', op: 'eq', value: 'y' })
  })

  it('normalizes malformed field definitions defensively', () => {
    const fields = normalizeFields([{ key: 'a', label: 'A', type: 'unknown-type' }, 'nonsense', { label: 'no key' }])
    expect(fields).toHaveLength(2)
    expect(fields[0].type).toBe('text')
    expect(fields[1].key).toBe('')
  })
})
