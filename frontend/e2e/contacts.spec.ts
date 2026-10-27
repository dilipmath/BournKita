import { expect, test } from '@playwright/test'
import { logInAsAdmin } from './credentials.ts'

test('an Admin records whom to call and who may pick a Child up', async ({ page }) => {
  // Unique per run, since the stack's database keeps data between runs.
  const lastName = `Contacts${Date.now()}`
  await logInAsAdmin(page)
  await page.goto('/children/new')
  await page.getByLabel('First name').fill('Lena')
  await page.getByLabel('Last name').fill(lastName)
  await page.getByRole('button', { name: 'Save' }).tap()

  const emergency = page.getByRole('region', { name: 'Emergency contacts' })
  await emergency.getByRole('button', { name: 'Add emergency contact' }).tap()
  const emergencyForm = emergency.getByRole('form', { name: 'Add emergency contact' })
  await emergencyForm.getByLabel('Name').fill('Erika Müller')
  await emergencyForm.getByLabel('Relationship').fill('Grandmother')
  await emergencyForm.getByLabel('Phone').fill('+49 30 7654321')
  await emergencyForm.getByRole('button', { name: 'Save' }).tap()
  await expect(emergency.getByRole('link', { name: '+49 30 7654321' })).toBeVisible()

  const pickUp = page.getByRole('region', { name: 'Who may pick up' })
  await pickUp.getByRole('button', { name: 'Add pick-up person' }).tap()
  const pickUpForm = pickUp.getByRole('form', { name: 'Add pick-up person' })
  await pickUpForm.getByLabel('Name').fill('Tom Weber')
  await pickUpForm.getByLabel('Note').fill('Shows his ID card')
  await pickUpForm.getByRole('button', { name: 'Save' }).tap()
  await expect(pickUp).toContainText('Shows his ID card')

  await page.reload()
  await expect(emergency).toContainText('Erika Müller')
  await expect(pickUp).toContainText('Tom Weber')
})
