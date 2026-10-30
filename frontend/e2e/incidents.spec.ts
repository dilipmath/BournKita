import { expect, test } from '@playwright/test'
import { logInAsAdmin } from './credentials.ts'

test('an incident reported from the Today view is in the log, where the Admin follows it up', async ({ page }) => {
  const run = Date.now()
  const groupName = `Frogs ${run}`
  const lastName = `Incident${run}`
  const name = `Lena ${lastName}`
  await logInAsAdmin(page)

  await page.getByRole('link', { name: 'Groups' }).tap()
  const newGroup = page.getByRole('form', { name: 'New Group' })
  await newGroup.getByLabel('Name').fill(groupName)
  await newGroup.getByRole('radio', { name: 'Frog' }).check()
  await newGroup.getByRole('button', { name: 'Create Group' }).tap()
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible()
  await page.goto('/children/new')
  await page.getByLabel('First name').fill('Lena')
  await page.getByLabel('Last name').fill(lastName)
  await page.getByRole('button', { name: 'Save' }).tap()
  const group = page.getByLabel('Group', { exact: true })
  await group.selectOption({ label: `🐸 ${groupName}` })
  await expect(group).not.toHaveValue('')

  await page.getByRole('link', { name: 'Start' }).tap()
  await expect(page.getByRole('heading', { name: 'System status' })).toBeVisible()
  await page.getByLabel('Group', { exact: true }).selectOption({ label: `🐸 ${groupName}` })
  const card = page.getByRole('listitem', { name })
  await card.getByRole('button', { name: `Report incident: ${name}` }).tap()
  const form = card.getByRole('form', { name: `Incident of ${name}` })
  await form.getByLabel('Time (if known)').fill('10:15')
  await form.getByLabel('What happened').fill('Fell off the slide, grazed her knee.')
  await form.getByLabel('Who was informed').fill('Mother, by phone')
  await form.getByRole('button', { name: 'Save' }).tap()
  await expect(card.getByRole('status')).toHaveText('Incident reported.')

  await page.getByRole('link', { name: 'Incident log' }).tap()
  const filters = page.getByRole('search', { name: 'Filter the incident log' })
  await filters.getByLabel('Child').selectOption({ label: name })
  await filters.getByRole('button', { name: 'Show' }).tap()
  const entry = page.getByRole('article', { name: new RegExp(`^${name}, `) })
  await expect(entry).toContainText('Fell off the slide, grazed her knee.')
  await expect(entry).toContainText('Informed: Mother, by phone')

  await entry.getByLabel('Follow-up').fill('Parents called back, all fine.')
  await entry.getByRole('button', { name: 'Add follow-up' }).tap()
  await expect(entry).toContainText('Parents called back, all fine.')
})
