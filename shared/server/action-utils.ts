import type { z } from 'zod'
import { invalid } from './errors'

/** Parses action input, turning a zod failure into a VALIDATION AppError. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input)
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'Invalid input'
    throw invalid(message)
  }
  return result.data
}
