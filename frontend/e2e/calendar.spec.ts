import { expect, test } from '@playwright/test'
import { logInAsAdmin } from './credentials.ts'

test('Staff add a weekly event, see it repeat, then change and delete it', async ({ page }) => {
  const title = `Music ${Date.now()}`
  await logInAsAdmin(page)
  await page.getByRole('link', { name: 'Calendar' }).tap()
  await expect(page.getByRole('heading', { name: 'Calendar: whole Kita' })).toBeVisible()

  // Every Monday of a month in the future: the e2e stack keeps no other Events there.
  await page.goto('/calendar?view=month&day=2031-03-01')
  await page.getByRole('button', { name: 'Add event' }).tap()
  const form = page.getByRole('form', { name: 'Add event' })
  await form.getByLabel('Title').fill(title)
  await form.getByLabel('All day').uncheck()
  await form.getByLabel('Starts on').fill('2031-03-03')
  await form.getByLabel('Start time').fill('10:00')
  await form.getByLabel('End time').fill('10:45')
  await form.getByLabel('Repeats').selectOption({ label: 'Every week' })
  await form.getByRole('button', { name: 'Save' }).tap()
  await expect(form).toBeHidden()

  const month = page.getByRole('table', { name: 'March 2031' })
  // Mondays 3, 10, 17, 24 and 31 March.
  await expect(month.getByRole('button', { name: `10:00 ${title}` })).toHaveCount(5)
  await expect(month.getByRole('cell', { name: '10 March', exact: true })).toContainText(`10:00 ${title}`)

  await page.getByRole('button', { name: 'Agenda' }).tap()
  await expect(page.getByRole('region', { name: 'Monday, 17 March' })).toContainText(`10:00–10:45 ${title}`)

  await page.getByRole('region', { name: 'Monday, 17 March' }).getByRole('button', { name: new RegExp(title) }).tap()
  const details = page.getByRole('region', { name: title })
  await expect(details).toContainText('Every week')
  await details.getByRole('button', { name: `Change ${title}` }).tap()
  await details.getByLabel('End time').fill('11:30')
  await details.getByRole('button', { name: 'Save' }).tap()
  await expect(page.getByRole('region', { name: 'Monday, 24 March' })).toContainText(`10:00–11:30 ${title}`)

  // Saved, not just shown; then gone with every occurrence.
  await page.reload()
  await page.getByRole('region', { name: 'Monday, 24 March' }).getByRole('button', { name: new RegExp(title) }).tap()
  await page.getByRole('region', { name: title }).getByRole('button', { name: `Delete ${title}` }).tap()
  await page.getByRole('group', { name: `Delete ${title}` }).getByRole('button', { name: 'Delete' }).tap()
  await expect(page.getByText(title)).toHaveCount(0)
})
