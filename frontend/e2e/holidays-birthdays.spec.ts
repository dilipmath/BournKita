import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { logInAsAdmin } from './credentials.ts'

const holidays = fileURLToPath(new URL('./fixtures/holidays-2031.ics', import.meta.url))

test('an Admin imports holidays and records a birthday, and the Calendar shows both', async ({ page }) => {
  const lastName = `Birthday${Date.now()}`
  await logInAsAdmin(page)

  await page.getByRole('link', { name: 'Calendar' }).tap()
  await page.getByRole('link', { name: 'Holidays' }).tap()
  const school = page.getByRole('region', { name: 'School holidays' })
  await school.getByLabel('iCal file (.ics)').setInputFiles(holidays)
  await school.getByRole('button', { name: 'Import school holidays' }).tap()
  await expect(school.getByRole('status')).toHaveText('2 holidays imported. They replace the ones before.')
  await expect(school).toContainText('2 imported, from 3 February 2031 to 14 February 2031.')

  await page.goto('/children/new')
  await page.getByLabel('First name').fill('Lena')
  await page.getByLabel('Last name').fill(lastName)
  await page.getByLabel('Date of birth').fill('2024-02-10')
  await page.getByRole('button', { name: 'Save' }).tap()
  await expect(page.getByText('10 February 2024')).toBeVisible()

  await page.goto('/calendar?view=month&day=2031-02-01')
  const month = page.getByRole('table', { name: 'February 2031' })
  // Winter holidays from Monday 3 to Friday 7 February.
  await expect(month.getByRole('cell', { name: '3 February', exact: true })).toContainText('Winterferien')
  await expect(month.getByRole('cell', { name: '7 February', exact: true })).toContainText('Winterferien')
  await expect(month.getByRole('cell', { name: '8 February', exact: true })).not.toContainText('Winterferien')
  const birthday = month.getByRole('cell', { name: '10 February', exact: true }).getByRole('link', { name: `Birthday: Lena ${lastName}` })
  await birthday.tap()
  await expect(page.getByRole('heading', { name: `Lena ${lastName}` })).toBeVisible()
})
