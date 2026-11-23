import { expect, test } from '@playwright/test'
import { logInAsAdmin } from './credentials.ts'

test('on a tablet, choosing a Group in the top bar opens its Today, and the choice stays', async ({ page }) => {
  const groupName = `Hedgehogs ${Date.now()}`
  await logInAsAdmin(page)
  await page.getByRole('link', { name: 'Administration' }).tap()
  await page.getByRole('link', { name: 'Groups' }).tap()
  const newGroup = page.getByRole('form', { name: 'New Group' })
  await newGroup.getByLabel('Name').fill(groupName)
  await newGroup.getByRole('radio', { name: 'Hedgehog' }).check()
  await newGroup.getByRole('button', { name: 'Create Group' }).tap()
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible()
  // The new Group is offered after the next page load.
  // On a page of no Group's (on the Children list, the drop-down filters the list instead).
  await page.goto('/administration')

  const choice = page.getByRole('combobox', { name: 'Current Group' })
  await expect(choice).toHaveValue('all')
  await choice.selectOption({ label: `🦔 ${groupName}` })

  await expect(page.getByRole('navigation', { name: 'The Group’s pages' })).toBeVisible()
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Children' }).tap()
  await expect(choice.locator('option:checked')).toHaveText(`🦔 ${groupName}`)
})
