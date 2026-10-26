import type { Page } from '@playwright/test'

export const e2eAdmin = { email: 'e2e-admin@kita.example', password: 'e2e admin password' }

/** Opens the start page and logs in as the e2e Admin (created by global-setup). */
export async function logInAsAdmin(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Email address').fill(e2eAdmin.email)
  await page.getByLabel('Password').fill(e2eAdmin.password)
  await page.getByRole('button', { name: 'Log in' }).tap()
}
