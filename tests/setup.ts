import { loadEnvConfig } from '@next/env'

// Vite/Vitest exposes `import.meta.env.BASE_URL` and also seeds
// `process.env.BASE_URL = '/'` in the worker. `@next/env` refuses to override
// already-set variables, so we clear the shadowing value before loading `.env`.
if (process.env.BASE_URL === '/') {
  delete process.env.BASE_URL
}

// Load `.env` (DATABASE_URL, BETTER_AUTH_SECRET, BASE_URL, ...) the same way
// Next.js does, so the Prisma adapter and Better Auth are configured for tests.
loadEnvConfig(process.cwd(), true)

// Sensible fallbacks when a variable is absent from `.env` in CI.
process.env.BASE_URL ??= 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET ??= 'test-secret-0123456789-test-secret-0123456789'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to run the test suite (see .env.example)')
}
