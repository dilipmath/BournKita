import { expect, test } from '@playwright/test'

test('the Landing page is in English and German', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
  // While the server works, nothing about it is shown.
  await expect(page.getByRole('alert')).toBeHidden()

  // The language choice at the top of the page (the footer has one too).
  await page.getByRole('button', { name: 'Deutsch' }).first().tap()

  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()
})
