import { expect, test } from '@playwright/test'
import { e2eAdmin, logInAsAdmin } from './credentials.ts'

test('an Admin sets up a Group, and the start page leads to its dashboard', async ({ page }) => {
  // Unique per run, since the stack's database keeps data between runs.
  const run = Date.now()
  const groupName = `Monkeys ${run}`
  const lastName = `Groups${run}`
  await logInAsAdmin(page)

  await page.getByRole('link', { name: 'Groups' }).tap()
  const newGroup = page.getByRole('form', { name: 'New Group' })
  await newGroup.getByLabel('Name').fill(groupName)
  await newGroup.getByRole('radio', { name: 'Monkey' }).check()
  await newGroup.getByRole('button', { name: 'Create Group' }).tap()
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible()

  await page.goto('/children/new')
  await page.getByLabel('First name').fill('Lena')
  await page.getByLabel('Last name').fill(lastName)
  await page.getByRole('button', { name: 'Save' }).tap()
  const group = page.getByLabel('Group', { exact: true })
  await expect(group.getByRole('option', { name: `🐒 ${groupName}` })).toBeAttached()
  await group.selectOption({ label: `🐒 ${groupName}` })
  await expect(group).not.toHaveValue('')

  await page.getByRole('link', { name: 'Staff accounts' }).tap()
  const works = page.getByRole('group', { name: `Groups of ${e2eAdmin.email}` }).getByRole('checkbox', { name: groupName })
  // Ticked once saved.
  await works.tap()
  await expect(works).toBeChecked()

  await page.getByRole('link', { name: 'Start' }).tap()
  await page.getByLabel('Group', { exact: true }).selectOption({ label: `🐒 ${groupName}` })
  await expect(page.getByRole('heading', { name: groupName, level: 2 })).toBeVisible()
  await expect(page.getByRole('link', { name: `Lena ${lastName}` })).toBeVisible()

  // This tablet remembers the Group.
  await page.getByRole('link', { name: 'Start' }).tap()
  await page.getByRole('link', { name: `Open ${groupName}` }).tap()
  await expect(page.getByRole('heading', { name: groupName, level: 2 })).toBeVisible()
})
