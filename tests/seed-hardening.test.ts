import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SeedConfigurationError,
  WEAK_PASSWORDS,
  assertSafeRootEmail,
  assertSafeRootPassword,
  isProductionSeed,
  resolveRootCredentials,
  shouldSeedDemoData,
} from '@/prisma/seed-lib'

const repoRoot = process.cwd()

describe('seed password policy', () => {
  it('rejects missing, short and placeholder passwords', () => {
    expect(() => assertSafeRootPassword(undefined)).toThrow(SeedConfigurationError)
    expect(() => assertSafeRootPassword('')).toThrow(SeedConfigurationError)
    expect(() => assertSafeRootPassword('short')).toThrow(SeedConfigurationError)
    expect(() => assertSafeRootPassword('rootroot')).toThrow(SeedConfigurationError)
    expect(() => assertSafeRootPassword('aaaaaaaaaaaaaa')).toThrow(SeedConfigurationError)
  })

  it('accepts a strong, unique password', () => {
    expect(() => assertSafeRootPassword('S3cur3-unique-Passphrase-2026')).not.toThrow()
  })

  it('never treats a shipped placeholder as safe', () => {
    // Every value advertised in the repo/examples must be refused.
    for (const value of ['rootroot', 'replace-with-a-long-random-secret', 'change-me-long-random']) {
      expect(WEAK_PASSWORDS.has(value)).toBe(true)
    }
  })
})

describe('root email policy', () => {
  it('requires a valid email', () => {
    expect(() => assertSafeRootEmail(undefined)).toThrow(SeedConfigurationError)
    expect(() => assertSafeRootEmail('not-an-email')).toThrow(SeedConfigurationError)
    expect(() => assertSafeRootEmail('admin@relay.com')).not.toThrow()
  })
})

describe('resolveRootCredentials', () => {
  it('does not need a password when the account already exists', () => {
    const result = resolveRootCredentials(
      { ROOT_EMAIL: 'Admin@Relay.com' },
      { accountExists: true }
    )
    expect(result).toBeNull()
  })

  it('requires a strong password when creating the account', () => {
    expect(() =>
      resolveRootCredentials({ ROOT_EMAIL: 'admin@relay.com' }, {
        accountExists: false,
      })
    ).toThrow(SeedConfigurationError)

    const ok = resolveRootCredentials(
      { ROOT_EMAIL: 'admin@relay.com', ROOT_PASSWORD: 'a-strong-unique-secret-123' },
      { accountExists: false }
    )
    expect(ok).toEqual({ email: 'admin@relay.com', password: 'a-strong-unique-secret-123' })
  })
})

describe('environment gating', () => {
  it('detects production from NODE_ENV or APP_ENV', () => {
    expect(isProductionSeed({ NODE_ENV: 'production' })).toBe(true)
    expect(isProductionSeed({ APP_ENV: 'production' })).toBe(true)
    expect(isProductionSeed({ NODE_ENV: 'development' })).toBe(false)
  })

  it('never seeds demo data in production unless explicitly opted in', () => {
    expect(shouldSeedDemoData({ NODE_ENV: 'production' })).toBe(false)
    expect(
      shouldSeedDemoData({ NODE_ENV: 'production', SEED_DEMO_DATA: 'true' })
    ).toBe(true)
    expect(shouldSeedDemoData({ NODE_ENV: 'development' })).toBe(true)
    expect(shouldSeedDemoData({ SEED_DEMO_DATA: 'false' })).toBe(false)
  })
})

describe('no insecure defaults are shipped', () => {
  const forbidden = ['rootroot', 'admin@relay.com', 'change-me-long-random']

  it('the seed source contains no default credentials', () => {
    const source = readFileSync(join(repoRoot, 'prisma', 'seed.ts'), 'utf8')
    for (const value of forbidden) {
      expect(source).not.toContain(value)
    }
    // The password value must never be echoed to the console.
    expect(source).not.toMatch(/console\.(log|info|error|warn)\([^)\n]*\.password/i)
  })

  it('.env.example ships empty placeholders, not real credentials', () => {
    const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8')
    for (const value of forbidden) {
      expect(envExample).not.toContain(value)
    }
    expect(envExample).toMatch(/ROOT_PASSWORD=""/)
  })
})
