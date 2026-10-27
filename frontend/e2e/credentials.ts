import type { Page } from '@playwright/test'

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
}

/** Fills in and sends the form for choosing a password from an emailed link. */
export async function choosePassword(page: Page, password: string): Promise<void> {
  await page.getByLabel('New password').fill(password)
  await page.getByLabel('Repeat password').fill(password)
  await page.getByRole('button', { name: 'Save password' }).tap()
}
