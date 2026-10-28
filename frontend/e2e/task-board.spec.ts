import { expect, test, type Locator, type Page } from '@playwright/test'
import { logInAsAdmin } from './credentials.ts'

/** Drags `from` onto `to` with a finger: real touch input, as a tablet sends it. */
async function touchDrag(page: Page, from: Locator, to: Locator): Promise<void> {
  const start = await from.boundingBox()
  const end = await to.boundingBox()
  if (!start || !end) throw new Error('Nothing to drag, or nowhere to drop it')
  const [x0, y0] = [start.x + start.width / 2, start.y + start.height / 2]
  const [x1, y1] = [end.x + end.width / 2, end.y + end.height / 2]
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  await touch('touchStart', x0, y0)
  for (let step = 1; step <= 10; step++) {
    await touch('touchMove', x0 + ((x1 - x0) * step) / 10, y0 + ((y1 - y0) * step) / 10)
  }
  await touch('touchEnd', x1, y1)
  await cdp.detach()
}

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
