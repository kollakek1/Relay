import { describe, expect, it } from 'vitest'
import { canTransition, isTerminal } from '@/features/task/server/state-machine'

describe('task state machine', () => {
  it('allows the happy path PENDING → CLAIMED → IN_PROGRESS → DONE', () => {
    expect(canTransition('PENDING', 'CLAIMED')).toBe(true)
    expect(canTransition('CLAIMED', 'IN_PROGRESS')).toBe(true)
    expect(canTransition('IN_PROGRESS', 'DONE')).toBe(true)
  })

  it('blocks skipping straight from PENDING to DONE', () => {
    expect(canTransition('PENDING', 'DONE')).toBe(false)
    expect(canTransition('PENDING', 'IN_PROGRESS')).toBe(false)
    expect(canTransition('BLOCKED', 'DONE')).toBe(false)
  })

  it('only lets BLOCKED become PENDING or CANCELLED', () => {
    expect(canTransition('BLOCKED', 'PENDING')).toBe(true)
    expect(canTransition('BLOCKED', 'CANCELLED')).toBe(true)
    expect(canTransition('BLOCKED', 'CLAIMED')).toBe(false)
  })

  it('lets a claimant release a task back to the pool', () => {
    expect(canTransition('CLAIMED', 'PENDING')).toBe(true)
  })

  it('treats DONE and CANCELLED as terminal', () => {
    expect(isTerminal('DONE')).toBe(true)
    expect(isTerminal('CANCELLED')).toBe(true)
    expect(isTerminal('IN_PROGRESS')).toBe(false)
    expect(canTransition('DONE', 'IN_PROGRESS')).toBe(false)
    expect(canTransition('CANCELLED', 'PENDING')).toBe(false)
  })
})
