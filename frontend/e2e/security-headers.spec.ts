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
