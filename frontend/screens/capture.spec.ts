// Takes screenshots of the app's main screens, in English and German, on the tablet viewport
// staff use, for the usability test (H3, docs/usability/screens). Not a test of the app: run it
// on its own, against the throwaway e2e stack, with made-up data only:
//
//   npm run screens
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { accountMenu, choosePassword, e2eAdmin, logIn, logInAsAdmin } from '../e2e/credentials.ts'
import { linkFromEmail } from '../e2e/mailpit.ts'

const out = fileURLToPath(new URL('../../docs/usability/screens/', import.meta.url))
// A Teacher in both Groups, for their start page.
const teacher = { email: 'aylin@kita.example', password: 'a teacher long password' }

async function post(api: APIRequestContext, url: string, data: object): Promise<{ id: number }> {
  const response = await api.post(url, { data })
  expect(response.ok(), `${url}: ${response.status()} ${await response.text()}`).toBe(true)
  return response.status() === 204 ? { id: 0 } : ((await response.json()) as { id: number })
}

async function put(api: APIRequestContext, url: string, data: object): Promise<void> {
  const response = await api.put(url, { data })
  expect(response.ok(), `${url}: ${response.status()} ${await response.text()}`).toBe(true)
}

/** Two Groups with made-up Children, Parents, Alerts, Tasks and Events, and a Teacher invited to
 * both. Returns the Monkeys' and Lena's ID. */
async function seed(api: APIRequestContext): Promise<{ group: number; lena: number }> {
  // Today at the Kita (Canadian English writes dates as YYYY-MM-DD).
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
  const group = (await post(api, '/api/groups', { name: 'Monkeys', icon: 'monkey' })).id
  const butterflies = (await post(api, '/api/groups', { name: 'Butterflies', icon: 'butterfly' })).id
  const children = [
    { firstName: 'Lena', lastName: 'Weber', dateOfBirth: '2022-03-14', languages: 'German, Turkish', foodPreferences: 'Vegetarian', interests: 'Painting, dinosaurs', symbol: 'kite' },
    { firstName: 'Mia', lastName: 'Schmidt', dateOfBirth: '2021-11-02', symbol: 'boat' },
    { firstName: 'Noah', lastName: 'Fischer', dateOfBirth: '2022-07-21', symbol: 'sun' },
    { firstName: 'Emil', lastName: 'Becker', dateOfBirth: '2021-05-30', symbol: 'fish' },
    { firstName: 'Sofia', lastName: 'Wagner', dateOfBirth: '2022-01-09', symbol: 'flower' },
  ]
  const ids: number[] = []
  for (const child of children) {
    const id = (await post(api, '/api/children', child)).id
    await put(api, `/api/children/${id}/group`, { groupId: group })
    ids.push(id)
  }
  const [lena, mia, noah] = ids
  await post(api, `/api/children/${lena}/alerts`, { kind: 'allergy', name: 'Peanuts', note: 'Epinephrine pen in the office' })
  await post(api, `/api/children/${noah}/alerts`, { kind: 'medical', name: 'Asthma', note: 'Inhaler in his bag' })
  const anna = (await post(api, '/api/parents', { firstName: 'Anna', lastName: 'Weber', address: 'Lindenstraße 12, 10115 Berlin', phone: '+49 30 1234567', email: 'anna.weber@example.org' })).id
  await put(api, `/api/children/${lena}/parents/${anna}`, {})
  await post(api, `/api/children/${lena}/contacts`, { kind: 'emergency', name: 'Erika Weber', relationship: 'Grandmother', phone: '+49 30 7654321' })
  await post(api, `/api/children/${lena}/contacts`, { kind: 'pickUp', name: 'Tom Krause', relationship: 'Neighbour', phone: '0171 2223334', note: 'Shows his ID card' })
  await post(api, `/api/children/${lena}/consents/photo/given`, { givenOn: today })
  for (const child of [lena, mia, noah]) await post(api, `/api/children/${child}/attendance/check-in`, {})
  await post(api, `/api/children/${mia}/attendance/check-out`, {})
  await post(api, `/api/children/${ids[4]}/absences`, { startsOn: today, reason: 'sick' })
  const ben = (await post(api, '/api/children', { firstName: 'Ben', lastName: 'Hoffmann', dateOfBirth: '2021-09-17', symbol: 'tree' })).id
  await put(api, `/api/children/${ben}/group`, { groupId: butterflies })
  await post(api, `/api/children/${ben}/attendance/check-in`, {})
  const aylin = (await post(api, '/api/staff', { email: teacher.email, role: 'teacher' })).id
  await put(api, `/api/staff/${aylin}/groups`, { groupIds: [group, butterflies] })
  for (const title of ['Buy craft paper', 'Call Lena’s parents about the trip', 'Plan the autumn festival']) {
    await post(api, `/api/groups/${group}/tasks`, { title })
  }
  const doing = (await post(api, `/api/groups/${group}/tasks`, { title: 'Repaint the sandpit sign', labels: ['garden'] })).id
  await put(api, `/api/groups/${group}/tasks/${doing}/status`, { status: 'doing' })
  await post(api, '/api/events', { title: 'Parents’ evening', startsOn: today, startTime: '18:00', endTime: '19:30', groupId: null })
  await post(api, '/api/events', { title: 'Trip to the farm', startsOn: today, groupId: group })
  return { group, lena }
}

// A phone held upright, for the screens that change most there.
const PHONE_WIDTH = 375

async function shoot(page: Page, language: 'en' | 'de', name: string, width?: number): Promise<void> {
  // Settled first: no spinner or half-loaded list in the picture.
  await page.waitForLoadState('networkidle')
  // As tall as the page, so the tab bar is at its foot as on the tablet (a full-page shot would
  // leave it where the tablet's screen ends), then back to the tablet's size.
  const tablet = page.viewportSize()!
  await page.setViewportSize({ width: width ?? tablet.width, height: tablet.height })
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  await page.setViewportSize({ width: width ?? tablet.width, height: Math.max(height, tablet.height) })
  await page.screenshot({ path: `${out}${language}/${name}.png` })
  await page.setViewportSize(tablet)
}

// Only the made-up data, for a usability session: `npm run usability-stack` (keeps the stack).
test('session data', async ({ page }) => {
  await logInAsAdmin(page)
  await seed(page.request)
})

test('screenshots of the main screens', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await shoot(page, 'en', '01-login')
  await shoot(page, 'en', '11-login-phone', PHONE_WIDTH)
  await logInAsAdmin(page)
  const { group, lena } = await seed(page.request)

  for (const language of ['en', 'de'] as const) {
    // German: chosen once in the account menu; the app remembers it for the pages after.
    if (language === 'de') {
      await page.goto('/')
      await accountMenu(page, e2eAdmin.email).tap()
      await page.getByRole('button', { name: 'Deutsch' }).tap()
      await page.keyboard.press('Escape')
    }
    await page.goto('/')
    await shoot(page, language, '02-start')
    await shoot(page, language, '12-start-phone', PHONE_WIDTH)
    await page.goto(`/groups/${group}`)
    await shoot(page, language, '03-group-today')
    await shoot(page, language, '13-group-today-phone', PHONE_WIDTH)
    // Before Lena goes home: who may pick her up.
    await page.getByRole('button', { name: language === 'en' ? 'Check out Lena Weber' : 'Lena Weber wird abgeholt' }).tap()
    await expect(page.getByText('Tom Krause')).toBeVisible()
    await shoot(page, language, '09-check-out')
    // The Children list, every Group's, and Lena's profile as the drawer over it.
    await page.goto('/children?group=all')
    await expect(page.getByRole('link', { name: 'Lena Weber' })).toBeVisible()
    await shoot(page, language, '16-children')
    await shoot(page, language, '17-children-phone', PHONE_WIDTH)
    await page.goto(`/children/${lena}?group=all`)
    await expect(page.getByRole('dialog', { name: 'Lena Weber' })).toBeVisible()
    await shoot(page, language, '04-child-profile')
    await shoot(page, language, '18-child-profile-phone', PHONE_WIDTH)
    await page.goto(`/groups/${group}/board`)
    await shoot(page, language, '05-task-board')
    await page.goto(`/groups/${group}/calendar`)
    await shoot(page, language, '06-calendar')
    await page.goto('/administration')
    await shoot(page, language, '10-administration')
    await page.goto('/staff')
    await shoot(page, language, '07-staff-accounts')
    await page.goto('/children')
    await page.getByRole('button', { name: 'Feedback' }).tap()
    await shoot(page, language, '08-feedback')
  }

  // A Teacher in both Groups: their start page, a card per Group. Onboarded in English.
  await page.context().clearCookies()
  await page.evaluate(() => localStorage.setItem('kita.language', 'en'))
  await page.goto(await linkFromEmail(teacher.email, '/verify-email'))
  await choosePassword(page, teacher.password)
  await page.getByRole('link', { name: 'Go to login' }).tap()
  await logIn(page, teacher.email, teacher.password)
  // Logged in before going anywhere: navigating sooner can cancel the login.
  await expect(accountMenu(page, teacher.email)).toBeVisible()
  for (const language of ['en', 'de'] as const) {
    if (language === 'de') {
      await accountMenu(page, teacher.email).tap()
      await page.getByRole('button', { name: 'Deutsch' }).tap()
      await page.keyboard.press('Escape')
    }
    await page.goto('/')
    await expect(page.getByRole('link', { name: /Butterflies/ })).toBeVisible()
    await shoot(page, language, '14-teacher-start')
    await shoot(page, language, '15-teacher-start-phone', PHONE_WIDTH)
  }

  // The login page in German: logged out; the language stays as chosen.
  await page.context().clearCookies()
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()
  await shoot(page, 'de', '01-login')
  await shoot(page, 'de', '11-login-phone', PHONE_WIDTH)
})
