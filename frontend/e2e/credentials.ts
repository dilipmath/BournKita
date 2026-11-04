import { expect, type Page } from '@playwright/test'

export const e2eAdmin = { email: 'e2e-admin@kita.example', password: 'e2e admin password' }

/** Fills in and sends the login form that is on screen. */
export async function logIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).tap()
}

/** Opens the start page and logs in as the e2e Admin (created by global-setup). */
export async function logInAsAdmin(page: Page): Promise<void> {
  await page.goto('/')
  await logIn(page, e2eAdmin.email, e2eAdmin.password)
  // Done only once the session exists; navigating sooner would show the login form again.
  await expect(accountMenu(page, e2eAdmin.email)).toBeVisible()
}

/** Fills in and sends the form for choosing a password from an emailed link. */
export async function choosePassword(page: Page, password: string): Promise<void> {
  await page.getByLabel('New password').fill(password)
  await page.getByLabel('Repeat password').fill(password)
  await page.getByRole('button', { name: 'Save password' }).tap()
}

/** The account menu's button, which shows who is logged in. */
export function accountMenu(page: Page, name: string) {
  return page.getByRole('button', { name: `Menu for ${name}` })
}

/** Logs out from the account menu, and waits until the login form is back. */
export async function logOut(page: Page, name: string = e2eAdmin.email): Promise<void> {
  await accountMenu(page, name).tap()
  await page.getByRole('button', { name: 'Log out' }).tap()
  // Only once logged out: navigating sooner can cancel the logout and keep the Admin's session.
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
}
