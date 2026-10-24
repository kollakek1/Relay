import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? process.env.BASE_URL ?? 'http://localhost:3000'

/**
 * Playwright configuration for the browser smoke test.
 *
 * The suite needs a live PostgreSQL (migrated) and a running server, so it is
 * opt-in: `E2E=1 npm run test:e2e`. The `webServer` block starts the dev server
 * automatically unless one is already running.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    locale: 'en-US',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      },
})
