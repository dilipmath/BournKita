import { expect, test } from '@playwright/test'
import { logInAsAdmin } from './credentials.ts'
import { touchDrag } from './touch.ts'

test('Staff plan a Task and put the backlog in order by touch', async ({ page }) => {
  // Unique per run, since the stack's database keeps data between runs.
  const run = Date.now()
  const groupName = `Foxes ${run}`
  await logInAsAdmin(page)

  await page.getByRole('link', { name: 'Groups' }).tap()
  const newGroup = page.getByRole('form', { name: 'New Group' })
  await newGroup.getByLabel('Name').fill(groupName)
  await newGroup.getByRole('radio', { name: 'Fox' }).check()
  await newGroup.getByRole('button', { name: 'Create Group' }).tap()
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible()

  await page.getByRole('link', { name: 'Start' }).tap()
  // Pick from the start page's drop-down only once that page shows.
  await expect(page.getByRole('heading', { name: 'System status' })).toBeVisible()
  await page.getByLabel('Group', { exact: true }).selectOption({ label: `🦊 ${groupName}` })
  await page.getByRole('link', { name: 'Task board' }).tap()

  const toDo = page.getByRole('region', { name: 'To do' })
  for (const title of ['Wash the smocks', 'Water the plants', 'Buy lantern paper']) {
    await toDo.getByRole('button', { name: 'Add task' }).tap()
    const form = page.getByRole('form', { name: 'Add task' })
    await form.getByLabel('Title').fill(title)
    if (title === 'Buy lantern paper') {
      await form.getByLabel('Due on').fill('2027-11-10')
      await form.getByLabel('Labels (separated by commas)').fill('Shopping, Festival')
    }
    await form.getByRole('button', { name: 'Save' }).tap()
    await expect(toDo).toContainText(title)
  }

  await page.getByRole('link', { name: 'Backlog' }).tap()
  const backlog = page.getByRole('list', { name: 'Backlog' })
  const items = backlog.getByRole('listitem')
  await expect(items).toHaveText([/#1.*Wash the smocks/, /#2.*Water the plants/, /#3.*Buy lantern paper.*Shopping.*Festival/])

  // The most important to the top: drag the last onto the first.
  await touchDrag(page, items.nth(2).locator('.drag-handle'), items.nth(0))
  await expect(items).toHaveText([/#1.*Buy lantern paper/, /#2.*Wash the smocks/, /#3.*Water the plants/])

  await page.getByRole('button', { name: 'Move Water the plants up' }).tap()
  await expect(items).toHaveText([/#1.*Buy lantern paper/, /#2.*Water the plants/, /#3.*Wash the smocks/])

  // Saved, and the board's To do column follows the same order.
  await page.reload()
  await expect(items).toHaveText([/Buy lantern paper/, /Water the plants/, /Wash the smocks/])
  await page.getByRole('link', { name: 'Back to the Task board' }).tap()
  await expect(toDo.getByRole('listitem')).toHaveText([/Buy lantern paper/, /Water the plants/, /Wash the smocks/])
})
