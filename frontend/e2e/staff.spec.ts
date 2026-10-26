import { expect, test } from '@playwright/test'
import { e2eAdmin } from './credentials.ts'

test('an Admin creates a Staff member, changes the role and deactivates the account', async ({ page }) => {
  // Unique per run, since the stack's database keeps accounts between runs.
  const email = `teacher-${Date.now()}@kita.example`
  await page.goto('/')
  await page.getByLabel('Email address').fill(e2eAdmin.email)
  await page.getByLabel('Password').fill(e2eAdmin.password)
  await page.getByRole('button', { name: 'Log in' }).tap()

  await page.getByRole('link', { name: 'Staff accounts' }).tap()
  await expect(page.getByRole('row', { name: new RegExp(e2eAdmin.email) })).toContainText('Active')

  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Role of the new Staff member').selectOption('teacher')
  await page.getByRole('button', { name: 'Create account' }).tap()

  const row = page.getByRole('row', { name: new RegExp(email) })
  await expect(row).toContainText('Invited – email not verified yet')

  await row.getByRole('combobox', { name: 'Role' }).selectOption('admin')
  await row.getByRole('button', { name: 'Deactivate' }).tap()
  await expect(row).toContainText('Deactivated')

  await page.reload()
  await expect(row.getByRole('combobox', { name: 'Role' })).toHaveValue('admin')
  await expect(row).toContainText('Deactivated')
})
