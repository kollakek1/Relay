import { expect, test } from '@playwright/test'

/**
 * Browser smoke test: the public site, language switching, documentation and a
 * full workflow lifecycle (sign up → create → publish → run → claim →
 * complete).
 *
 * Requires a migrated database and a running server. Run with:
 *   E2E=1 npm run test:e2e
 */

test.describe('public site', () => {
  test('renders the landing page and switches language', async ({ page }) => {
    await page.goto('/')

    const hero = page.getByRole('heading', { level: 1 })
    await expect(hero).toContainText(/Run every process/i)

    // Switch to Russian via a language switcher (aria-label is the language name).
    await page.getByRole('button', { name: 'Русский' }).first().click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru', { timeout: 15_000 })
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Ведите каждый процесс/i)

    // Switch back — the preference is persisted in a cookie, not in memory.
    await page.getByRole('button', { name: 'English' }).first().click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 15_000 })
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Run every process/i)
  })

  test('serves documentation and the API reference', async ({ page }) => {
    await page.goto('/docs')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Documentation')

    await page.goto('/docs/quickstart')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Quickstart')

    await page.goto('/api-reference')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('API reference')
    await expect(page.getByRole('button', { name: /GET/ }).first()).toBeVisible()

    // The OpenAPI document is downloadable and is valid JSON.
    const response = await page.request.get('/api/openapi')
    expect(response.ok()).toBeTruthy()
    const spec = await response.json()
    expect(spec.openapi).toMatch(/^3\.1/)
  })

  test('shows a localised 404', async ({ page }) => {
    const response = await page.goto('/definitely-not-a-page')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/not found/i)
  })
})

test.describe('workflow lifecycle', () => {
  test.slow()

  test('sign up, create, publish, run and complete a task', async ({ page }) => {
    const suffix = Date.now().toString(36)
    const email = `e2e_${suffix}@relay.test`
    const password = 'E2e-strong-password-123'
    const stepName = `E2E step ${suffix}`
    const workflowName = `E2E workflow ${suffix}`

    // --- 1. Register -------------------------------------------------------
    await page.goto('/dashboard/auth')
    await page.getByRole('tab', { name: 'Create account' }).click()
    await page.getByLabel('Name').fill('E2E User')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm password').fill(password)
    await page.getByRole('button', { name: 'Create account' }).click()

    await page.waitForURL('**/dashboard', { timeout: 30_000 })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // --- 2. Create a workflow ---------------------------------------------
    await page.goto('/dashboard/workflows')
    await page.getByRole('button', { name: 'New workflow' }).click()
    await page.getByLabel('Name').fill(workflowName)
    await page.getByRole('button', { name: 'Create draft' }).click()

    await page.waitForURL('**/dashboard/workflows/**', { timeout: 30_000 })
    // The draft already contains one empty step; name it.
    await page.locator('#step-name-0').fill(stepName)

    // --- 3. Publish and run ------------------------------------------------
    await page.getByRole('button', { name: 'Save draft' }).click()
    await expect(page.getByText('Draft saved')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Workflow published')).toBeVisible({ timeout: 20_000 })

    const startButton = page.getByRole('button', { name: 'Start instance' })
    await expect(startButton).toBeEnabled({ timeout: 20_000 })
    await startButton.click()
    await expect(page.getByText(/running/i).first()).toBeVisible({ timeout: 20_000 })

    // --- 4. Claim a task from the pool -------------------------------------
    await page.goto('/dashboard/pool')
    const claim = page.getByRole('button', { name: 'Claim' }).first()
    await expect(claim).toBeVisible({ timeout: 20_000 })
    await claim.click()

    // --- 5. Complete the task ----------------------------------------------
    await page.goto('/dashboard/tasks')
    await page.getByRole('link', { name: stepName }).first().click()
    await page.waitForURL('**/dashboard/tasks/**', { timeout: 30_000 })

    const startWorking = page.getByRole('button', { name: 'Start working' })
    if (await startWorking.isVisible().catch(() => false)) {
      await startWorking.click()
    }
    await page.getByRole('button', { name: 'Complete' }).click()
    await expect(page.getByText(/done/i).first()).toBeVisible({ timeout: 20_000 })

    // --- 6. The dashboard reflects the new state ---------------------------
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
