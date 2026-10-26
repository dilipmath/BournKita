import { expect, test, type Page, type Request } from '@playwright/test'

function nextCrashReport(page: Page): Promise<Request> {
  return page.waitForRequest(
    (request) => request.method() === 'POST' && new URL(request.url()).pathname === '/api/crash-reports',
  )
}

test('an unhandled error in the browser is reported', async ({ page }) => {
  await page.goto('/')
  const reported = nextCrashReport(page)

  await page.evaluate(() => {
    setTimeout(() => {
      throw new TypeError('Anna Müller, Erdnussallergie')
    })
  })

  const request = await reported
  expect(request.postDataJSON()).toMatchObject({ errorType: 'TypeError', page: '/' })
  expect((await request.response())?.status()).toBe(202)
})

test('an unhandled promise rejection in the browser is reported', async ({ page }) => {
  await page.goto('/')
  const reported = nextCrashReport(page)

  await page.evaluate(() => {
    void Promise.reject(new RangeError('Anna Müller'))
  })

  const request = await reported
  expect(request.postDataJSON()).toMatchObject({ errorType: 'RangeError', page: '/' })
  expect((await request.response())?.status()).toBe(202)
})
