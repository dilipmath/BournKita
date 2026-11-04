import { expect, test } from '@playwright/test'

test('the login page is in English and German', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
  // While the server works, nothing about it is shown.
  await expect(page.getByRole('alert')).toBeHidden()

  await page.getByRole('button', { name: 'Deutsch' }).tap()

  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()
})
