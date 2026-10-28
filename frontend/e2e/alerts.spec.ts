import { expect, test } from '@playwright/test'
import { logInAsAdmin } from './credentials.ts'

test('an Admin records an allergy, and it shows on the profile and the Group dashboard', async ({ page }) => {
  // Unique per run, since the stack's database keeps data between runs.
  const run = Date.now()
  const groupName = `Bees ${run}`
  const lastName = `Alerts${run}`
  await logInAsAdmin(page)

  await page.getByRole('link', { name: 'Groups' }).tap()
  const newGroup = page.getByRole('form', { name: 'New Group' })
  await newGroup.getByLabel('Name').fill(groupName)
  await newGroup.getByRole('radio', { name: 'Bee' }).check()
  await newGroup.getByRole('button', { name: 'Create Group' }).tap()
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible()

  await page.goto('/children/new')
  await page.getByLabel('First name').fill('Lena')
  await page.getByLabel('Last name').fill(lastName)
  await page.getByLabel('Food preferences').fill('Vegetarian')
  await page.getByRole('button', { name: 'Save' }).tap()
  const group = page.getByLabel('Group', { exact: true })
  await group.selectOption({ label: `🐝 ${groupName}` })
  await expect(group).not.toHaveValue('')

  const banner = page.getByRole('region', { name: 'Allergies and medical conditions' })
  await banner.getByRole('button', { name: 'Add allergy or medical condition' }).tap()
  const form = banner.getByRole('form', { name: 'Add allergy or medical condition' })
  await form.getByLabel('Allergic to, or condition').fill('Peanuts')
  await form.getByLabel('What to do').fill('EpiPen in the red bag')
  await form.getByRole('button', { name: 'Save' }).tap()
  await expect(banner).toContainText('EpiPen in the red bag')

  await page.reload()
  await expect(banner).toContainText('Peanuts')
  await expect(page.getByText('Allergies: Peanuts')).toBeVisible()

  await page.getByRole('link', { name: 'Start' }).tap()
  await page.getByLabel('Group', { exact: true }).selectOption({ label: `🐝 ${groupName}` })
  const lena = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: `Lena ${lastName}` }) })
  await expect(lena).toContainText('Alerts: Peanuts')
})
