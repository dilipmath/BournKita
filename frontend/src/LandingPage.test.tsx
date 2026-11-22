// @vitest-environment happy-dom
import { isInaccessible, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import i18n from './i18n'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const loggedOut = { status: 401, body: { detail: 'not_logged_in' } }

describe('the hero', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
  })
  afterEach(async () => {
    vi.useRealTimers()
    await i18n.changeLanguage('en')
  })

  it('opens with the promise, and the login card in it with a greeting', async () => {
    // 07:30 at the Kita in winter.
    vi.setSystemTime(new Date('2027-01-04T06:30:00Z'))
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)

    const hero = await screen.findByRole('region', { name: 'Every child in view, from first check-in to pick-up.' })
    const form = within(hero).getByRole('form', { name: 'Log in' })
    expect(within(form).getByRole('heading', { name: 'Good morning' })).toBeInTheDocument()
    // The account decides the Role: nobody says which one they are.
    expect(within(form).queryByRole('radio')).toBeNull()
    expect(within(form).queryByText('I am')).toBeNull()
    expect(within(form).getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute('href', '/forgot-password')
  })

  it('says good evening late in the day, in German too', async () => {
    vi.setSystemTime(new Date('2027-01-04T17:30:00Z'))
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    await i18n.changeLanguage('de')
    renderAt('/', <App />)

    const hero = await screen.findByRole('region', { name: 'Alle Kinder im Blick, vom ersten Check-in bis zur Abholung.' })
    const form = within(hero).getByRole('form', { name: 'Anmelden' })
    expect(within(form).getByRole('heading', { name: 'Guten Abend' })).toBeInTheDocument()
  })

  it('hangs invented name tags on its rail, skipped by screen readers', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)

    await screen.findByRole('form', { name: 'Log in' })
    // Lina hangs on the rail only, never in the demo below.
    expect(isInaccessible(screen.getByText('Lina'))).toBe(true)
  })

  it('logs in from the card', async () => {
    vi.setSystemTime(new Date('2027-01-04T09:00:00Z'))
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': loggedOut,
      'POST /api/session': sessionAs('teacher'),
      'GET /api/overview/mine': { status: 200, body: { day: '2027-01-04', groups: [] } },
      'GET /api/groups': { status: 200, body: [] },
    })
    renderAt('/', <App />)

    const form = await screen.findByRole('form', { name: 'Log in' })
    await userEvent.type(within(form).getByLabelText('Email address'), 'teacher@kita.example')
    await userEvent.type(within(form).getByLabelText('Password'), 'a long password')
    await userEvent.click(within(form).getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('button', { name: 'Menu for teacher@kita.example' })).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Log in' })).toBeNull()
  })
})

describe('the top bar', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('puts the cursor in the email field when Log in is tapped', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)

    const logIn = await screen.findByRole('link', { name: 'Log in' })
    expect(logIn).toHaveAttribute('href', '#login')
    expect(screen.getByRole('form', { name: 'Log in' })).toHaveAttribute('id', 'login')
    await userEvent.click(logIn)
    expect(screen.getByLabelText('Email address')).toHaveFocus()
  })

  it('leads to each part of the page', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)

    const sections = await screen.findByRole('navigation', { name: 'On this page' })
    const links = within(sections).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Attendance', 'A day', 'Roles', 'Privacy'])
    const targets = links.map((link) => document.getElementById(link.getAttribute('href')!.slice(1)))
    expect(targets.map((target) => target && within(target).getAllByRole('heading', { level: 2 })[0].textContent)).toEqual([
      'Attendance in one tap',
      'How a day runs',
      'Who can do what',
      'Data that stays in the building',
    ])
  })

  it('in German too', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    await i18n.changeLanguage('de')
    renderAt('/', <App />)

    const sections = await screen.findByRole('navigation', { name: 'Auf dieser Seite' })
    expect(within(sections).getAllByRole('link').map((link) => link.textContent)).toEqual(['Anwesenheit', 'Tagesablauf', 'Rollen', 'Datenschutz'])
    expect(screen.getByRole('link', { name: 'Anmelden' })).toBeInTheDocument()
  })

  it('keeps the pages opened from an email without the Landing page', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/forgot-password', <App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'BournKita' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Every child in view, from first check-in to pick-up.' })).toBeNull()
  })
})

describe('the Attendance demo', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('checks in an invented Child, says so, and takes it back, all without the server', async () => {
    const calls = fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)

    const demo = await screen.findByRole('region', { name: 'Attendance in one tap' })
    expect(within(demo).getByText('Example')).toBeVisible()
    expect(within(demo).getByText('3 of 6 are here')).toBeInTheDocument()
    const before = calls.length

    await userEvent.click(within(demo).getByRole('button', { name: 'Elias Not here yet' }))

    expect(within(demo).getByRole('button', { name: 'Elias Here' })).toBeInTheDocument()
    expect(within(demo).getByText('4 of 6 are here')).toBeInTheDocument()
    // Announced, as the real check-in is.
    const toast = screen.getByText('Example: Elias is here')
    expect(toast.closest('[aria-live="polite"]')).not.toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))

    expect(within(demo).getByRole('button', { name: 'Elias Not here yet' })).toBeInTheDocument()
    expect(within(demo).getByText('3 of 6 are here')).toBeInTheDocument()
    expect(calls.slice(before)).toEqual([])
  })

  it('sends a Child home with the next tap, in German too', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    await i18n.changeLanguage('de')
    renderAt('/', <App />)

    const demo = await screen.findByRole('region', { name: 'Anwesenheit mit einem Tipp' })
    expect(within(demo).getByText('Beispiel')).toBeVisible()
    await userEvent.click(within(demo).getByRole('button', { name: 'Mia Da' }))

    expect(within(demo).getByRole('button', { name: 'Mia Abgeholt' })).toBeInTheDocument()
    expect(screen.getByText('Beispiel: Mia ist abgeholt')).toBeInTheDocument()
    expect(within(demo).getByText('2 von 6 sind da')).toBeInTheDocument()
  })
})

describe('below the demo', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('runs through a day, from arrival to pick-up', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)

    const day = await screen.findByRole('region', { name: 'How a day runs' })
    const moments = within(within(day).getByRole('list')).getAllByRole('listitem')
    expect(moments.map((moment) => [moment.querySelector('time')?.textContent, within(moment).getByRole('heading', { level: 3 }).textContent])).toEqual([
      ['07:30', 'Arrival'],
      ['09:00', 'Morning circle'],
      ['11:45', 'Lunch'],
      ['13:00', 'Nap'],
      ['15:30', 'Pick-up'],
    ])
  })

  it('shows what each Role may do, as the app allows it', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)

    const table = await screen.findByRole('table', { name: 'What each Role may do' })
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Task', 'Admin', 'Teacher', 'Guest'])
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => [within(row).getByRole('rowheader').textContent, ...within(row).getAllByRole('cell').map((cell) => cell.textContent)])
    expect(rows).toEqual([
      ['View Child profiles', 'Yes', 'Yes', 'No'],
      ['Create, change and archive Child profiles', 'Yes', 'No', 'No'],
      ['Check Children in and out', 'Yes', 'Yes', 'No'],
      ['Report Incidents', 'Yes', 'Yes', 'No'],
      ['Work on the Groups’ Task boards', 'Yes', 'Yes', 'No'],
      ['Add and change Events', 'Yes', 'Yes', 'No'],
      ['See the Calendar', 'Yes', 'Yes', 'Kita-wide only'],
      ['Manage Groups and Staff accounts', 'Yes', 'No', 'No'],
    ])
  })

  it('promises only what the app keeps, saying what leaves the building', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)

    const privacy = await screen.findByRole('region', { name: 'Data that stays in the building' })
    expect(within(privacy).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Your Kita’s own server',
      'No trackers',
      'Archive with a Retention period',
      'Audit log',
    ])
    const server = within(privacy).getByText(/What leaves it/)
    expect(server).toHaveTextContent('Reminders')
    expect(server).toHaveTextContent('encrypted weekly backup')
  })

  it('names the Roles as the app does in German', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    await i18n.changeLanguage('de')
    renderAt('/', <App />)

    const table = await screen.findByRole('table', { name: 'Was jede Rolle darf' })
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Aufgabe', 'Leitung', 'Erzieher:in', 'Gast'])
  })
})

describe('the footer', () => {
  afterEach(async () => {
    vi.useRealTimers()
    await i18n.changeLanguage('en')
  })

  it('ends with BournKita, the language and the current year', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-03-01T09:00:00Z'))
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)

    expect(await screen.findByText('© 2027 BournKita')).toBeInTheDocument()
    vi.useRealTimers()
    // At the top and at the foot of the page.
    const languages = screen.getAllByRole('navigation', { name: 'Language' })
    expect(languages).toHaveLength(2)
    await userEvent.click(within(languages[1]).getByRole('button', { name: 'Deutsch' }))

    expect(await screen.findByRole('heading', { name: 'Alle Kinder im Blick, vom ersten Check-in bis zur Abholung.' })).toBeInTheDocument()
    for (const each of screen.getAllByRole('navigation', { name: 'Sprache' })) {
      expect(within(each).getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'true')
    }
  })
})

describe('the Kita’s name', () => {
  it('shows the Kita’s name and logo beside BournKita', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': loggedOut,
      'GET /api/kita': { status: 200, body: { name: 'Kita Sonnenschein', hasLogo: true } },
    })
    renderAt('/', <App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'BournKita' })).toBeInTheDocument()
    expect(await screen.findByText('Kita Sonnenschein')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Logo of Kita Sonnenschein' })).toHaveAttribute('src', '/api/kita/logo')
  })

  it('shows BournKita alone without one', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': loggedOut,
      'GET /api/kita': { status: 200, body: { name: null, hasLogo: false } },
    })
    renderAt('/', <App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'BournKita' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Logo/ })).toBeNull()
  })
})

describe('the login form', () => {
  const loginApi = (reply: { status: number; body?: unknown }) =>
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut, 'GET /api/kita': { status: 200, body: { name: null, hasLogo: false } }, 'POST /api/session': reply })

  it('shows the password while typing, and hides it again after sending', async () => {
    loginApi({ status: 401, body: { detail: 'invalid_credentials' } })
    renderAt('/', <App />)

    const password = await screen.findByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')
    const show = screen.getByRole('button', { name: 'Show password' })
    expect(show).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(show)
    expect(password).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true')
    // Password managers fill it in: the field still says what it is.
    expect(password).toHaveAttribute('autocomplete', 'current-password')

    await userEvent.type(screen.getByLabelText('Email address'), 'teacher@kita.example')
    await userEvent.type(password, 'wrong password')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Email address or password is wrong.')).toBeInTheDocument()
    expect(password).toHaveAttribute('type', 'password')
  })

  it('moves the keyboard to the message when a login is refused', async () => {
    loginApi({ status: 401, body: { detail: 'invalid_credentials' } })
    renderAt('/', <App />)

    await userEvent.type(await screen.findByLabelText('Email address'), 'teacher@kita.example')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong password')
    await userEvent.keyboard('{Enter}')

    // Read out once, with the hint about lockouts.
    await screen.findByText('Email address or password is wrong.')
    expect(document.activeElement).toHaveTextContent('Email address or password is wrong.')
    expect(document.activeElement).toHaveTextContent('After 5 failed logins in a row')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says it is logging in and takes no second tap meanwhile', async () => {
    const calls = loginApi(sessionAs('teacher'))
    // The server answers only when the test says so.
    let answer: (response: Response) => void = () => undefined
    const fakeFetch = fetch
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
      init?.method === 'POST' && url === '/api/session'
        ? new Promise<Response>((resolve) => {
            calls.push({ route: 'POST /api/session', body: undefined })
            answer = resolve
          })
        : fakeFetch(url, init),
    )
    renderAt('/', <App />)

    await userEvent.type(await screen.findByLabelText('Email address'), 'teacher@kita.example')
    await userEvent.type(screen.getByLabelText('Password'), 'a long password')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    const busy = screen.getByRole('button', { name: 'Logging in…' })
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(busy)

    expect(calls.filter((call) => call.route === 'POST /api/session')).toHaveLength(1)
    answer(new Response(JSON.stringify(sessionAs('teacher').body), { status: 200 }))
  })
})
