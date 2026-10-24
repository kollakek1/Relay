import { describe, expect, it } from 'vitest'
import { AppError } from '@/shared/server/errors'
import { buildStepSnapshot, validateForPublish } from '@/features/workflow/server/validation'

describe('workflow publish validation', () => {
  it('normalizes step order to 1..n', () => {
    const snapshot = buildStepSnapshot([
      { name: 'A', description: undefined, assigneeRole: null, dueInDays: null },
      { name: 'B', description: 'second', assigneeRole: 'ADMIN', dueInDays: 3 },
    ])
    expect(snapshot.map((s) => s.order)).toEqual([1, 2])
    expect(snapshot[1]).toMatchObject({ name: 'B', assigneeRole: 'ADMIN', dueInDays: 3 })
  })

  it('rejects an empty workflow', () => {
    expect(() => validateForPublish([])).toThrow(AppError)
  })

  it('rejects duplicate step names (case-insensitive)', () => {
    expect(() =>
      validateForPublish([
        { name: 'Review', description: undefined, assigneeRole: null, dueInDays: null },
        { name: 'review', description: undefined, assigneeRole: null, dueInDays: null },
      ])
    ).toThrow(/Duplicate/)
  })

  it('accepts a valid linear workflow', () => {
    const snapshot = validateForPublish([
      { name: 'Draft', description: undefined, assigneeRole: null, dueInDays: 1 },
      { name: 'Review', description: undefined, assigneeRole: 'ADMIN', dueInDays: 2 },
      { name: 'Publish', description: undefined, assigneeRole: null, dueInDays: null },
    ])
    expect(snapshot).toHaveLength(3)
  })
})
