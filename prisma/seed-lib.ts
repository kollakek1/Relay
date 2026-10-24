/**
 * Pure, side-effect-free helpers for the database seed.
 *
 * Kept separate from `prisma/seed.ts` (which performs I/O) so the safety rules
 * can be unit-tested without touching a database or the process environment.
 */

/** Loosely-typed environment bag (a subset of `process.env`). */
export type EnvLike = Record<string, string | undefined>

/** Placeholder / commonly-leaked passwords that must never bootstrap a root. */
export const WEAK_PASSWORDS = new Set([
  'rootroot',
  'password',
  'password1',
  'changeme',
  'change-me',
  'admin',
  'admin123',
  'administrator',
  'letmein',
  'secret',
  'relay',
  'relay-admin',
  'replace-with-a-long-random-secret',
  'change-me-long-random',
  'test',
  'test1234',
  'qwerty123',
])

const MIN_PASSWORD_LENGTH = 12

export interface RootCredentials {
  email: string
  password: string
}

export class SeedConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SeedConfigurationError'
  }
}

export function isProductionSeed(env: EnvLike = process.env): boolean {
  return env.NODE_ENV === 'production' || env.APP_ENV === 'production'
}

function isWeakPassword(password: string): boolean {
  const normalised = password.trim().toLowerCase()
  if (normalised.length < MIN_PASSWORD_LENGTH) return true
  if (WEAK_PASSWORDS.has(normalised)) return true
  // A password made of a single repeated character is never safe.
  if (/^(.)\1+$/.test(password)) return true
  return false
}

/**
 * Validates a candidate root password. Throws {@link SeedConfigurationError}
 * with an actionable message when the password is missing, too short, a known
 * placeholder, or otherwise trivially guessable. Never returns or logs the
 * password.
 */
export function assertSafeRootPassword(password: string | undefined): asserts password is string {
  if (!password || password.trim().length === 0) {
    throw new SeedConfigurationError(
      'ROOT_PASSWORD is not set. Provide a strong, unique password in the environment ' +
        '(at least 12 characters) before seeding. It will not be printed or stored in plain text.'
    )
  }
  if (isWeakPassword(password)) {
    throw new SeedConfigurationError(
      'ROOT_PASSWORD is too weak. Use at least 12 characters and avoid placeholder or ' +
        'dictionary values — Relay refuses to bootstrap an administrator with a guessable password.'
    )
  }
}

/** Validates and normalises the root email address. */
export function assertSafeRootEmail(email: string | undefined): asserts email is string {
  const value = email?.trim().toLowerCase()
  if (!value) {
    throw new SeedConfigurationError(
      'ROOT_EMAIL is not set. Set it to the address of the first administrator account.'
    )
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new SeedConfigurationError('ROOT_EMAIL is not a valid email address.')
  }
}

/**
 * Resolves the credentials used to bootstrap the first administrator.
 *
 * The password is only required when the account does not exist yet — rotating
 * or re-running the seed against an existing administrator never needs it.
 */
export function resolveRootCredentials(
  env: EnvLike,
  options: { accountExists: boolean }
): RootCredentials | null {
  assertSafeRootEmail(env.ROOT_EMAIL)
  const email = env.ROOT_EMAIL.trim().toLowerCase()

  if (options.accountExists) {
    return null
  }

  assertSafeRootPassword(env.ROOT_PASSWORD)
  return { email, password: env.ROOT_PASSWORD }
}

/**
 * Whether demo content (a "Relay Demo" workspace and a sample workflow) should
 * be created. Never in production unless explicitly opted in.
 */
export function shouldSeedDemoData(env: EnvLike = process.env): boolean {
  if (env.SEED_DEMO_DATA === 'true') return true
  if (env.SEED_DEMO_DATA === 'false') return false
  return !isProductionSeed(env)
}
