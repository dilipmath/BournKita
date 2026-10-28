import { expect, test } from '@playwright/test'
import { logInAsAdmin } from './credentials.ts'
import { touchDrag } from './touch.ts'

test('Staff drag a Task across their Group’s board by touch', async ({ page }) => {
  // Unique per run, since the stack's database keeps data between runs.
  const run = Date.now()
  const groupName = `Owls ${run}`
  const title = `Wash the smocks ${run}`
  await logInAsAdmin(page)

  await page.getByRole('link', { name: 'Groups' }).tap()
  const newGroup = page.getByRole('form', { name: 'New Group' })
  await newGroup.getByLabel('Name').fill(groupName)
  await newGroup.getByRole('radio', { name: 'Owl' }).check()
  await newGroup.getByRole('button', { name: 'Create Group' }).tap()
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible()

  await page.getByRole('link', { name: 'Start' }).tap()
  await expect(page.getByRole('heading', { name: 'System status' })).toBeVisible()
  await page.getByLabel('Group', { exact: true }).selectOption({ label: `🦉 ${groupName}` })
  await page.getByRole('link', { name: 'Task board' }).tap()
  await expect(page.getByRole('heading', { name: `Task board: ${groupName}` })).toBeVisible()

  const toDo = page.getByRole('region', { name: 'To do' })
  const doing = page.getByRole('region', { name: 'Doing' })
  const done = page.getByRole('region', { name: 'Done' })
  await toDo.getByRole('button', { name: 'Add task' }).tap()
  const form = page.getByRole('form', { name: 'Add task' })
  await form.getByLabel('Title').fill(title)
  await form.getByRole('button', { name: 'Save' }).tap()
  await expect(toDo).toContainText(title)

  const task = page.getByRole('listitem').filter({ hasText: title })
  await touchDrag(page, task.locator('.drag-handle'), doing)
  await expect(doing).toContainText(title)
  await expect(toDo).not.toContainText(title)

  await touchDrag(page, task.locator('.drag-handle'), done)
  await expect(done).toContainText(title)

  // Saved, not just shown.
  await page.reload()
  await expect(done).toContainText(title)
})
