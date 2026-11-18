import { expect, test } from '@playwright/test'

test('the web server tells browsers to load only the app’s own files and never to frame it', async ({ request }) => {
  const appPage = await request.get('/')
  const policy = appPage.headers()['content-security-policy'] ?? ''

  expect(policy).toContain("default-src 'self'")
  expect(policy).toContain("frame-ancestors 'none'")
  expect(policy).toContain("object-src 'none'")
  expect(appPage.headers()['x-content-type-options']).toBe('nosniff')
  expect(appPage.headers()['x-frame-options']).toBe('DENY')
  // API answers too: a browser must never guess a different type for them.
  const api = await request.get('/api/health')
  expect(api.headers()['x-content-type-options']).toBe('nosniff')
})

test('the app’s typeface comes from the app’s own files, under that policy', async ({ page, baseURL }) => {
  const own = new URL(baseURL!).origin
  const elsewhere: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== own) elsewhere.push(request.url())
  })
  const refused: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) refused.push(message.text())
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'BournKita' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  expect(await page.evaluate(() => document.fonts.check('17px "Atkinson Hyperlegible"'))).toBe(true)
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/^"?Atkinson Hyperlegible/)
  expect(refused).toEqual([])
  expect(elsewhere).toEqual([])
})
