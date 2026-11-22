import { expect, test } from '@playwright/test'
import { logInAsAdmin } from './credentials.ts'

test('at the door, a Child is checked in with one tap and undone, checked out through the pick-up check, and another marked absent', async ({ page }) => {
  const run = Date.now()
  const groupName = `Hedgehogs ${run}`
  const lastName = `Today${run}`
  await logInAsAdmin(page)

  await page.getByRole('link', { name: 'Administration' }).tap()
  await page.getByRole('link', { name: 'Groups' }).tap()
  const newGroup = page.getByRole('form', { name: 'New Group' })
  await newGroup.getByLabel('Name').fill(groupName)
  await newGroup.getByRole('radio', { name: 'Hedgehog' }).check()
  await newGroup.getByRole('button', { name: 'Create Group' }).tap()
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible()
  // Each with a Symbol of their own: two Children in a Group never share one.
  for (const [firstName, symbol] of [['Lena', 'Kite'], ['Mia', 'Boat']]) {
    await page.goto('/children/new')
    await page.getByLabel('First name').fill(firstName)
    await page.getByLabel('Last name').fill(lastName)
    await page.getByRole('radiogroup', { name: 'Symbol' }).getByRole('radio', { name: symbol }).check()
    await page.getByRole('button', { name: 'Save' }).tap()
    const group = page.getByLabel('Group', { exact: true })
    await group.selectOption({ label: `🦔 ${groupName}` })
    await expect(group).not.toHaveValue('')
  }

  await page.getByRole('link', { name: 'Home' }).tap()
  // An Admin's start page, the Kita overview: a tile for each Group.
  await page.getByRole('link', { name: new RegExp(groupName) }).tap()
  const lena = page.getByRole('listitem', { name: `Lena ${lastName}` })
  const mia = page.getByRole('listitem', { name: `Mia ${lastName}` })
  await expect(lena).toContainText('Not here yet')

  // One tap on the tag; the toast's Undo takes it back.
  await lena.getByRole('button', { name: `Check in Lena ${lastName}` }).tap()
  await expect(lena).toContainText(/Here \d\d:\d\d/)
  await page.locator('.toast', { hasText: /^Lena is here/ }).getByRole('button', { name: 'Undo' }).tap()
  await expect(lena).toContainText('Not here yet')
  await lena.getByRole('button', { name: `Check in Lena ${lastName}` }).tap()
  await expect(lena).toContainText(/Here \d\d:\d\d/)
  await mia.getByRole('button', { name: `Absent: Mia ${lastName}` }).tap()
  const absence = page.getByRole('form', { name: `Absence of Mia ${lastName}` })
  await absence.getByLabel('Reason').selectOption({ label: 'Holiday' })
  await absence.getByRole('button', { name: 'Save' }).tap()
  await expect(mia).toContainText('Absent: Holiday')
  await expect(page.getByRole('region', { name: 'Today in numbers' })).toContainText('1 of 2 Children is here')

  await lena.getByRole('button', { name: `Check out Lena ${lastName}` }).tap()
  await expect(lena.getByRole('region', { name: `Who may pick up Lena ${lastName}` })).toContainText('Nobody may pick up yet.')
  await lena.getByRole('button', { name: `Lena ${lastName} goes home now` }).tap()
  await expect(lena).toContainText(/Gone home \d\d:\d\d/)

  // Saved, not just shown.
  await page.reload()
  await expect(lena).toContainText(/Gone home \d\d:\d\d/)
  await expect(mia).toContainText('Absent: Holiday')
})
