import { expect, test } from '@playwright/test'
import { logInAsAdmin } from './credentials.ts'

test('an Admin records a Consent given and later withdrawn', async ({ page }) => {
  // Unique per run, since the stack's database keeps data between runs.
  const lastName = `Consents${Date.now()}`
  await logInAsAdmin(page)
  await page.goto('/children/new')
  await page.getByLabel('First name').fill('Lena')
  await page.getByLabel('Last name').fill(lastName)
  await page.getByRole('button', { name: 'Save' }).tap()

  const consents = page.getByRole('region', { name: 'Consents' })
  const photos = consents.getByRole('listitem').filter({ hasText: 'Photos' })
  await expect(photos).toContainText('Photos: not given')

  await photos.getByRole('button', { name: 'Record giving of Photos' }).tap()
  const giving = photos.getByRole('form', { name: 'Record giving of Photos' })
  await giving.getByLabel('Given on').fill('2026-03-01')
  await giving.getByRole('button', { name: 'Save' }).tap()
  await expect(photos).toContainText('Photos: given since Mar 1, 2026')

  // Withdrawn today, the date the form suggests.
  await photos.getByRole('button', { name: 'Record withdrawal of Photos' }).tap()
  await photos.getByRole('form', { name: 'Record withdrawal of Photos' }).getByRole('button', { name: 'Save' }).tap()
  await expect(photos).toContainText('Photos: withdrawn on')

  await page.reload()
  await expect(photos).toContainText('History: Given Mar 1, 2026, withdrawn')
  await expect(photos.getByRole('button', { name: 'Record giving of Photos' })).toBeVisible()
})
