import { expect, test } from '@playwright/test'

test('app can be installed on a tablet home screen', async ({ page }) => {
  await page.goto('/')

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifestHref).toBeTruthy()

  const manifest = await (await page.request.get(manifestHref!)).json()
  expect(manifest.name).toBe('Kita Kids Database')
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  )

  const serviceWorkerActive = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    return registration.active !== null
  })
  expect(serviceWorkerActive).toBe(true)
})
