import { expect, test } from '@playwright/test'
import { logInAsAdmin } from './credentials.ts'

test('the Emergency button in a Group prints its emergency list as a PDF', async ({ page }) => {
  const run = Date.now()
  const groupName = `Owls ${run}`
  await logInAsAdmin(page)

  await page.getByRole('link', { name: 'Administration' }).tap()
  await page.getByRole('link', { name: 'Groups' }).tap()
  const newGroup = page.getByRole('form', { name: 'New Group' })
  await newGroup.getByLabel('Name').fill(groupName)
  await newGroup.getByRole('radio', { name: 'Owl' }).check()
  await newGroup.getByRole('button', { name: 'Create Group' }).tap()
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible()
  await page.getByRole('link', { name: 'Home' }).tap()
  // An Admin's start page, the Kita overview: a tile for each Group.
  await page.getByRole('link', { name: new RegExp(groupName) }).tap()

  // Opened in a tab of its own, with the tablet's session: a PDF the browser shows and prints.
  const pdf = page.context().waitForEvent('response', (response) => response.url().includes('/api/emergency-list'))
  await page.getByRole('button', { name: 'Emergency' }).tap()
  await page.getByRole('link', { name: 'Emergency list (PDF)' }).tap()
  const response = await pdf

  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe('application/pdf')
})
