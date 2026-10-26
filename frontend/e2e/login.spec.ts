import { expect, test } from '@playwright/test'
import { e2eAdmin } from './credentials.ts'

test('a Staff member logs in from the start page and logs out again', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Email address').fill(e2eAdmin.email)
  await page.getByLabel('Password').fill(e2eAdmin.password)
  await page.getByRole('button', { name: 'Log in' }).tap()

  await expect(page.getByText(`Logged in as ${e2eAdmin.email}`)).toBeVisible()

  await page.reload()
  await expect(page.getByText(`Logged in as ${e2eAdmin.email}`)).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).tap()

  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
})

test('wrong credentials show a clear message', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Email address').fill(e2eAdmin.email)
  await page.getByLabel('Password').fill('not the password')
  await page.getByRole('button', { name: 'Log in' }).tap()

  await expect(page.getByRole('alert')).toHaveText('Email address or password is wrong.')
})

test('the login form comes back once the session has timed out', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByLabel('Email address').fill(e2eAdmin.email)
  await page.getByLabel('Password').fill(e2eAdmin.password)
  await page.getByRole('button', { name: 'Log in' }).tap()
  await expect(page.getByText(`Logged in as ${e2eAdmin.email}`)).toBeVisible()

  // The server's clock cannot be moved from here, so answer as it would after 30 idle minutes.
  await page.route('/api/session', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ status: 401, json: { detail: 'not_logged_in' } }) : route.continue(),
  )
  await page.clock.fastForward('31:00')

  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
  await expect(page.getByText(`Logged in as ${e2eAdmin.email}`)).toBeHidden()
})
