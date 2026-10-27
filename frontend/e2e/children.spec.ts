import { expect, test } from '@playwright/test'
import { logInAsAdmin } from './credentials.ts'

test('an Admin creates, finds, edits and deletes a Child profile', async ({ page }) => {
  // Unique per run, since the stack's database keeps data between runs.
  const lastName = `Müller${Date.now()}`
  await logInAsAdmin(page)

  await page.getByRole('link', { name: 'Children' }).tap()
  await page.getByRole('link', { name: 'New Child profile' }).tap()
  await page.getByLabel('First name').fill('Lena')
  await page.getByLabel('Last name').fill(lastName)
  await page.getByLabel('Gender').selectOption('girl')
  await page.getByLabel('Food preferences').fill('Vegetarisch')
  await page.getByRole('button', { name: 'Save' }).tap()
  await expect(page.getByRole('heading', { name: `Lena ${lastName}` })).toBeVisible()

  await page.getByRole('link', { name: 'Back to the list' }).tap()
  await page.getByRole('searchbox', { name: 'Search by name' }).fill(lastName.toLowerCase())
  await page.getByRole('link', { name: `Lena ${lastName}` }).tap()

  await page.getByRole('link', { name: 'Edit' }).tap()
  await page.getByLabel('Interests').fill('Dinosaurier')
  await page.getByRole('button', { name: 'Save' }).tap()
  // Checked on the profile itself, not in the form that was just filled in.
  const interests = page.getByRole('definition').filter({ hasText: 'Dinosaurier' })
  await expect(interests).toBeVisible()
  await page.reload()
  await expect(interests).toBeVisible()

  await page.getByRole('button', { name: 'Delete' }).tap()
  await page.getByRole('button', { name: 'Delete profile' }).tap()
  await expect(page.getByRole('status')).toHaveText(`The profile of Lena ${lastName} was deleted.`)
  await page.getByRole('searchbox', { name: 'Search by name' }).fill(lastName.toLowerCase())
  await expect(page.getByText('No Children found.')).toBeVisible()
})
