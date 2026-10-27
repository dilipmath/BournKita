import { expect, test, type Page } from '@playwright/test'
import { logInAsAdmin } from './credentials.ts'

async function createChild(page: Page, firstName: string, lastName: string) {
  await page.goto('/children/new')
  await page.getByLabel('First name').fill(firstName)
  await page.getByLabel('Last name').fill(lastName)
  await page.getByRole('button', { name: 'Save' }).tap()
  await expect(page.getByRole('heading', { name: `${firstName} ${lastName}` })).toBeVisible()
}

test('an Admin records a Parent for one Child and links them to the Sibling', async ({ page }) => {
  // Unique per run, since the stack's database keeps data between runs.
  const lastName = `Parent${Date.now()}`
  await logInAsAdmin(page)

  await createChild(page, 'Lena', lastName)
  await page.getByRole('link', { name: 'Add Parent' }).tap()
  const form = page.getByRole('form', { name: 'New Parent' })
  await form.getByLabel('First name').fill('Anna')
  await form.getByLabel('Last name').fill(lastName)
  await form.getByLabel('Address', { exact: true }).fill('Lindenstraße 12, 10115 Berlin')
  await form.getByLabel('Phone').fill('+49 30 1234567')
  await form.getByRole('button', { name: 'Save and link' }).tap()
  const parents = page.getByRole('region', { name: 'Parents' })
  await expect(parents).toContainText('Lindenstraße 12, 10115 Berlin')

  await createChild(page, 'Max', lastName)
  await page.getByRole('link', { name: 'Add Parent' }).tap()
  await page.getByRole('searchbox', { name: 'Find a recorded Parent' }).fill(lastName)
  await page.getByRole('button', { name: `Link Anna ${lastName}` }).tap()
  await expect(parents.getByRole('link', { name: '+49 30 1234567' })).toBeVisible()

  await parents.getByRole('link', { name: `Anna ${lastName}` }).tap()
  await expect(page.getByRole('link', { name: `Lena ${lastName}` })).toBeVisible()
  await expect(page.getByRole('link', { name: `Max ${lastName}` })).toBeVisible()
})
