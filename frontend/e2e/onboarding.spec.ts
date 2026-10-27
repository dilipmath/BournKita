import { expect, test } from '@playwright/test'
import { choosePassword, logIn, logInAsAdmin } from './credentials.ts'
import { linkFromEmail } from './mailpit.ts'

test('a new Staff member follows the emailed link, chooses a password and logs in', async ({ page }) => {
  const email = `onboarding-${Date.now()}@kita.example`
  const password = 'my own long password'
  await logInAsAdmin(page)
  await page.getByRole('link', { name: 'Staff accounts' }).tap()
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('button', { name: 'Create account' }).tap()
  await expect(page.getByRole('status')).toHaveText(`A verification email has been sent to ${email}.`)
  await page.getByRole('button', { name: 'Log out' }).tap()

  await page.goto(await linkFromEmail(email, '/verify-email'))
  await choosePassword(page, password)
  await page.getByRole('link', { name: 'Go to login' }).tap()

  await logIn(page, email, password)
  await expect(page.getByText(`Logged in as ${email}`)).toBeVisible()
})
