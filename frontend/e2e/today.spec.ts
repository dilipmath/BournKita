import { expect, test } from '@playwright/test'
import { logInAsAdmin } from './credentials.ts'

test('at the door, a Child is checked in and out by tap, and another marked absent', async ({ page }) => {
  const run = Date.now()
  const groupName = `Hedgehogs ${run}`
  const lastName = `Today${run}`
  await logInAsAdmin(page)

  await page.getByRole('link', { name: 'Groups' }).tap()
  const newGroup = page.getByRole('form', { name: 'New Group' })
  await newGroup.getByLabel('Name').fill(groupName)
  await newGroup.getByRole('radio', { name: 'Hedgehog' }).check()
  await newGroup.getByRole('button', { name: 'Create Group' }).tap()
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible()
  for (const firstName of ['Lena', 'Mia']) {
    await page.goto('/children/new')
    await page.getByLabel('First name').fill(firstName)
    await page.getByLabel('Last name').fill(lastName)
    await page.getByRole('button', { name: 'Save' }).tap()
    const group = page.getByLabel('Group', { exact: true })
    await group.selectOption({ label: `🦔 ${groupName}` })
    await expect(group).not.toHaveValue('')
  }

  await page.getByRole('link', { name: 'Start' }).tap()
  await expect(page.getByRole('heading', { name: 'System status' })).toBeVisible()
  await page.getByLabel('Group', { exact: true }).selectOption({ label: `🦔 ${groupName}` })
  const lena = page.getByRole('listitem', { name: `Lena ${lastName}` })
  const mia = page.getByRole('listitem', { name: `Mia ${lastName}` })
  await expect(lena).toContainText('Not here yet')

  await lena.getByRole('button', { name: `Check in Lena ${lastName}` }).tap()
  await expect(lena).toContainText('Here since')
  await mia.getByRole('button', { name: `Absent: Mia ${lastName}` }).tap()
  const absence = page.getByRole('form', { name: `Absence of Mia ${lastName}` })
  await absence.getByLabel('Reason').selectOption({ label: 'Holiday' })
  await absence.getByRole('button', { name: 'Save' }).tap()
  await expect(mia).toContainText('Absent: Holiday')
  await expect(page.getByText('Here 1 · Gone home 0 · Absent 1 · Not here yet 0')).toBeVisible()

  await lena.getByRole('button', { name: `Check out Lena ${lastName}` }).tap()
  await expect(lena).toContainText('Gone home at')

  // Saved, not just shown.
  await page.reload()
  await expect(lena).toContainText('Gone home at')
  await expect(mia).toContainText('Absent: Holiday')
})
