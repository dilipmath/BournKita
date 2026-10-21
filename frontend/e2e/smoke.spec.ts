import { expect, test } from '@playwright/test'

test('start page shows the system status in English and German', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'System status' })).toBeVisible()
  await expect(page.getByText('All systems working')).toBeVisible()

  await page.getByRole('button', { name: 'Deutsch' }).tap()

  await expect(page.getByRole('heading', { name: 'Systemstatus' })).toBeVisible()
  await expect(page.getByText('Alles funktioniert')).toBeVisible()
})
