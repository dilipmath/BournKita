import { expect, test } from '@playwright/test'
import { choosePassword, logIn, logInAsAdmin } from './credentials.ts'
import { linkFromEmail } from './mailpit.ts'

test('a Staff member who forgot their password chooses a new one from the emailed link', async ({ page }) => {
  // A Staff member of its own, so the shared e2e Admin's password stays as it is.
  const email = `forgetful-${Date.now()}@kita.example`
  await logInAsAdmin(page)
  await page.getByRole('link', { name: 'Staff accounts' }).tap()
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('button', { name: 'Create account' }).tap()
  await expect(page.getByRole('status')).toHaveText(`A verification email has been sent to ${email}.`)
  await page.getByRole('button', { name: 'Log out' }).tap()
  // Only once logged out: navigating sooner can cancel the logout and keep the Admin's session.
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
  await page.goto(await linkFromEmail(email, '/verify-email'))
  await choosePassword(page, 'first long password')
  await expect(page.getByRole('status')).toHaveText('Your password is saved. You can now log in.')

  await page.goto('/')
  await page.getByRole('link', { name: 'Forgot your password?' }).tap()
  // The login form has an email field too; wait until it is gone.
  await expect(page.getByRole('heading', { name: 'Forgot your password' })).toBeVisible()
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('button', { name: 'Send link' }).tap()
  await expect(page.getByRole('status')).toContainText(`If ${email} has an account`)
  await page.goto(await linkFromEmail(email, '/reset-password'))
  await choosePassword(page, 'second long password')
  await page.getByRole('link', { name: 'Go to login' }).tap()

  await logIn(page, email, 'first long password')
  await expect(page.getByRole('alert')).toHaveText('Email address or password is wrong.')
  await logIn(page, email, 'second long password')
  await expect(page.getByText(`Logged in as ${email}`)).toBeVisible()
})
