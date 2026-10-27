import { expect, test } from '@playwright/test'
import { e2eAdmin, logInAsAdmin } from './credentials.ts'

test('viewing and changing a Child profile shows up in the audit log', async ({ page }) => {
  // Unique per run, since the stack's database keeps data between runs.
  const lastName = `Audit${Date.now()}`
  await logInAsAdmin(page)

  await page.getByRole('link', { name: 'Children' }).tap()
  await page.getByRole('link', { name: 'New Child profile' }).tap()
  await page.getByLabel('First name').fill('Jonas')
  await page.getByLabel('Last name').fill(lastName)
  await page.getByRole('button', { name: 'Save' }).tap()
  await page.getByRole('link', { name: 'Edit' }).tap()
  await page.getByLabel('Interests').fill('Fußball')
  await page.getByRole('button', { name: 'Save' }).tap()
  await expect(page.getByRole('heading', { name: `Jonas ${lastName}` })).toBeVisible()

  await page.getByRole('link', { name: 'Audit log for this Child' }).tap()
  await expect(page.getByText(`Showing only entries about Jonas ${lastName}.`)).toBeVisible()
  const rows = page.getByRole('row').filter({ hasText: e2eAdmin.email })
  // Newest first: viewed after saving, changed, viewed before editing, created.
  await expect(rows.nth(0)).toContainText('Viewed')
  await expect(rows.nth(1)).toContainText('Changed')
  await expect(rows.nth(1)).toContainText('Interests')
  await expect(rows.last()).toContainText('Created')
})
