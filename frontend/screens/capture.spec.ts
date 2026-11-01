// Takes screenshots of the app's main screens, in English and German, on the tablet viewport
// staff use, for the usability test (H3, docs/usability/screens). Not a test of the app: run it
// on its own, against the throwaway e2e stack, with made-up data only:
//
//   npm run screens
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { logInAsAdmin } from '../e2e/credentials.ts'

const out = fileURLToPath(new URL('../../docs/usability/screens/', import.meta.url))

async function post(api: APIRequestContext, url: string, data: object): Promise<{ id: number }> {
  const response = await api.post(url, { data })
  expect(response.ok(), `${url}: ${response.status()} ${await response.text()}`).toBe(true)
  return response.status() === 204 ? { id: 0 } : ((await response.json()) as { id: number })
}

async function put(api: APIRequestContext, url: string, data: object): Promise<void> {
  const response = await api.put(url, { data })
  expect(response.ok(), `${url}: ${response.status()} ${await response.text()}`).toBe(true)
}

/** A Group with made-up Children, Parents, Alerts, Tasks and Events. Returns its and Lena's ID. */
async function seed(api: APIRequestContext): Promise<{ group: number; lena: number }> {
  // Today at the Kita (Canadian English writes dates as YYYY-MM-DD).
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
  const group = (await post(api, '/api/groups', { name: 'Monkeys', icon: 'monkey' })).id
  await post(api, '/api/groups', { name: 'Butterflies', icon: 'butterfly' })
  const children = [
    { firstName: 'Lena', lastName: 'Weber', dateOfBirth: '2022-03-14', languages: 'German, Turkish', foodPreferences: 'Vegetarian', interests: 'Painting, dinosaurs' },
    { firstName: 'Mia', lastName: 'Schmidt', dateOfBirth: '2021-11-02' },
    { firstName: 'Noah', lastName: 'Fischer', dateOfBirth: '2022-07-21' },
    { firstName: 'Emil', lastName: 'Becker', dateOfBirth: '2021-05-30' },
    { firstName: 'Sofia', lastName: 'Wagner', dateOfBirth: '2022-01-09' },
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
  for (const title of ['Buy craft paper', 'Call Lena’s parents about the trip', 'Plan the autumn festival']) {
    await post(api, `/api/groups/${group}/tasks`, { title })
  }
  const doing = (await post(api, `/api/groups/${group}/tasks`, { title: 'Repaint the sandpit sign', labels: ['garden'] })).id
  await put(api, `/api/groups/${group}/tasks/${doing}/status`, { status: 'doing' })
  await post(api, '/api/events', { title: 'Parents’ evening', startsOn: today, startTime: '18:00', endTime: '19:30', groupId: null })
  await post(api, '/api/events', { title: 'Trip to the farm', startsOn: today, groupId: group })
  return { group, lena }
}

async function shoot(page: Page, language: 'en' | 'de', name: string): Promise<void> {
  // Settled first: no spinner or half-loaded list in the picture.
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${out}${language}/${name}.png`, fullPage: true })
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
  await logInAsAdmin(page)
  const { group, lena } = await seed(page.request)

  // Each page in the language of this round (the app remembers the last choice; tapping it again is harmless).
  async function open(path: string, language: 'en' | 'de'): Promise<void> {
    await page.goto(path)
    if (language === 'de') await page.getByRole('button', { name: 'Deutsch' }).tap()
  }

  for (const language of ['en', 'de'] as const) {
    await open('/', language)
    await shoot(page, language, '02-start')
    await open(`/groups/${group}`, language)
    await shoot(page, language, '03-group-today')
    await open(`/children/${lena}`, language)
    await shoot(page, language, '04-child-profile')
    await open(`/groups/${group}/board`, language)
    await shoot(page, language, '05-task-board')
    await open(`/groups/${group}/calendar`, language)
    await shoot(page, language, '06-calendar')
    await open('/staff', language)
    await shoot(page, language, '07-staff-accounts')
    await open('/children', language)
    await page.getByRole('button', { name: 'Feedback' }).tap()
    await shoot(page, language, '08-feedback')
  }

  // The login page in German: logged out, then one tap.
  await page.context().clearCookies()
  await open('/', 'de')
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()
  await shoot(page, 'de', '01-login')
})
