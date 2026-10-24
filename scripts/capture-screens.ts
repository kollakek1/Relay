/**
 * Regenerates the README screenshots from a real, running instance.
 *
 * It signs up a throwaway user, builds a small workflow, publishes it, runs an
 * instance, claims and completes one task (so analytics has data), then captures
 * the public site and the main dashboard surfaces into `docs/assets/screens/`.
 *
 * Usage:
 *   npm run dev            # in one terminal (with a migrated database)
 *   npm run screenshots    # in another
 *
 * Set E2E_BASE_URL to point at a different origin. The account it creates is
 * disposable; it never touches existing data.
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type Page } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL ?? process.env.BASE_URL ?? 'http://localhost:3000'
const OUT_DIR = join(process.cwd(), 'docs', 'assets', 'screens')

async function capture(page: Page, name: string, opts: { fullPage?: boolean } = {}) {
  await page.waitForLoadState('load').catch(() => undefined)
  await page.waitForTimeout(1200) // let fonts, animations and images settle
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage: opts.fullPage ?? false })
  console.log(`  saved ${name}.png`)
}

async function setStepName(page: Page, index: number, value: string) {
  await page.locator(`#step-name-${index}`).fill(value)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  console.log(`Capturing from ${BASE_URL} into ${OUT_DIR}`)

  const browser = await chromium.launch()
  const context = await browser.newContext({
    baseURL: BASE_URL,
    locale: 'en-US',
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  const suffix = Date.now().toString(36)
  const email = `shots_${suffix}@relay.test`
  const password = 'Screens-strong-password-123'

  // --- Public site -----------------------------------------------------------
  await page.goto('/')
  await capture(page, 'landing-en', { fullPage: false })

  await page.getByRole('button', { name: 'Русский' }).first().click()
  await page.waitForFunction(() => document.documentElement.lang === 'ru')
  await capture(page, 'landing-ru')
  await page.getByRole('button', { name: 'English' }).first().click()
  await page.waitForFunction(() => document.documentElement.lang === 'en')

  await page.goto('/docs/quickstart')
  await capture(page, 'docs-quickstart')

  await page.goto('/api-reference')
  await capture(page, 'api-reference')

  // --- Sign up ---------------------------------------------------------------
  await page.goto('/dashboard/auth')
  await page.getByRole('tab', { name: 'Create account' }).click()
  await page.getByLabel('Name').fill('Demo User')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL('**/dashboard', { timeout: 30_000 })

  // --- Build a workflow with several steps -----------------------------------
  await page.goto('/dashboard/workflows')
  await page.getByRole('button', { name: 'New workflow' }).click()
  await page.getByLabel('Name').fill('Content review')
  await page.getByRole('button', { name: 'Create draft' }).click()
  await page.waitForURL('**/dashboard/workflows/**', { timeout: 30_000 })

  await setStepName(page, 0, 'Draft the content')
  for (let index = 1; index < 4; index += 1) {
    await page.getByRole('button', { name: 'Add step' }).click()
  }
  await setStepName(page, 1, 'Editorial review')
  await setStepName(page, 2, 'Legal approval')
  await setStepName(page, 3, 'Publish')

  await page.getByRole('button', { name: 'Save draft' }).click()
  await page.getByText('Draft saved').waitFor({ timeout: 20_000 })

  await capture(page, 'workflow-builder')

  await page.getByRole('button', { name: 'Publish' }).click()
  await page.getByText('Workflow published').waitFor({ timeout: 20_000 })

  const startButton = page.getByRole('button', { name: 'Start instance' })
  await startButton.waitFor({ state: 'visible' })
  await startButton.click()
  await page.waitForURL('**/dashboard/instances', { timeout: 30_000 })

  // --- Claim and complete one task so analytics has data ---------------------
  await page.goto('/dashboard/pool')
  const claim = page.getByRole('button', { name: 'Claim' }).first()
  await claim.waitFor({ state: 'visible', timeout: 20_000 })

  await capture(page, 'task-pool')

  await claim.click()
  await page.goto('/dashboard/tasks')
  await page.getByRole('link', { name: 'Draft the content' }).first().click()
  await page.waitForURL('**/dashboard/tasks/**', { timeout: 30_000 })
  const startWorking = page.getByRole('button', { name: 'Start working' })
  if (await startWorking.isVisible().catch(() => false)) await startWorking.click()
  await page.getByRole('button', { name: 'Complete' }).click()
  await page.getByText(/done/i).first().waitFor({ timeout: 20_000 })

  await capture(page, 'task-detail')

  // --- Dashboard and analytics ----------------------------------------------
  await page.goto('/dashboard')
  await capture(page, 'dashboard')

  await page.goto('/dashboard/analytics')
  await capture(page, 'analytics')

  await browser.close()
  console.log('Done.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
