// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import i18n from './i18n'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const loggedOut = { status: 401, body: { detail: 'not_logged_in' } }

describe('login page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
  })
  afterEach(async () => {
    vi.useRealTimers()
    await i18n.changeLanguage('en')
  })

  it('greets by the time of day at the Kita and says what the app is for', async () => {
    // 07:30 at the Kita in winter.
    vi.setSystemTime(new Date('2027-01-04T06:30:00Z'))
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)

    expect(await screen.findByRole('heading', { name: 'Good morning' })).toBeInTheDocument()
    const about = screen.getByRole('list', { name: 'What you find here' })
    expect(within(about).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Who is here today, at a glance',
      'Allergies, conditions and who may pick up, when they matter',
      'On the Kita’s own server: nothing leaves the building',
    ])
    expect(screen.getByRole('form', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByText('Trouble logging in? Ask the Kita manager.')).toBeInTheDocument()
  })

  it('says good evening late in the day, in German too', async () => {
    vi.setSystemTime(new Date('2027-01-04T17:30:00Z'))
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    await i18n.changeLanguage('de')
    renderAt('/', <App />)

    expect(await screen.findByRole('heading', { name: 'Guten Abend' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Anmelden' })).toBeInTheDocument()
    expect(screen.getByText('Probleme beim Anmelden? Fragen Sie die Kita-Leitung.')).toBeInTheDocument()
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

describe('the top of the Landing page', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('opens with the promise and a way to log in', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)

    expect(await screen.findByRole('heading', { level: 2, name: 'Less admin. More playtime.' })).toBeInTheDocument()
    const logIns = screen.getAllByRole('link', { name: 'Log in' })
    // In the top bar and in the hero, both to the login card.
    expect(logIns).toHaveLength(2)
    for (const link of logIns) expect(link).toHaveAttribute('href', '#login')
    expect(screen.getByRole('form', { name: 'Log in' })).toHaveAttribute('id', 'login')
  })

  it('puts the cursor in the email field when Log in is tapped', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)

    await userEvent.click((await screen.findAllByRole('link', { name: 'Log in' }))[1])
    expect(screen.getByLabelText('Email address')).toHaveFocus()
  })

  it('leads to each part of the page from the top bar', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)

    const sections = await screen.findByRole('navigation', { name: 'On this page' })
    const links = within(sections).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Features', 'Why BournKita', 'How it works'])
    for (const link of links) {
      const target = document.getElementById(link.getAttribute('href')!.slice(1))
      expect(target).toHaveRole('region')
    }
  })

  it('in German too', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    await i18n.changeLanguage('de')
    renderAt('/', <App />)

    expect(await screen.findByRole('heading', { level: 2, name: 'Weniger Verwaltung. Mehr Zeit zum Spielen.' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Anmelden' })).toHaveLength(2)
    expect(screen.getByRole('navigation', { name: 'Auf dieser Seite' })).toBeInTheDocument()
  })

  it('keeps the pages opened from an email without it', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/forgot-password', <App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'BournKita' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull()
  })
})

describe('below the login', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('says what the app does for the Kita day', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)

    const features = await screen.findByRole('region', { name: 'Everything for the Kita day' })
    expect(within(features).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Today',
      'Child profiles',
      'Groups and Task boards',
      'Calendar',
      'Incidents',
      'Staff accounts',
    ])
  })

  it('shows how a Kita gets started, step by step', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)

    const start = await screen.findByRole('region', { name: 'How a Kita gets started' })
    const steps = within(within(start).getByRole('list')).getAllByRole('listitem')
    expect(steps.map((step) => within(step).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'An Admin sets up the Kita',
      'The children are added',
      'Every morning, mark who is here',
    ])
  })

  it('says why the Kita’s data is safe with it', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)

    const why = await screen.findByRole('region', { name: 'Made for the people who care for little people' })
    expect(within(why).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Runs on the Kita’s own server, in the local network only',
      'Each Role sees only what it needs; the Audit log shows who viewed or changed a Child’s data',
      'A deleted Child profile waits in the Archive, then is purged after the Retention period',
      'On tablets and phones, in English and German',
    ])
  })

  it('leads back up to the login from the end of the page, in German too', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    await i18n.changeLanguage('de')
    renderAt('/', <App />)

    expect(await screen.findByRole('region', { name: 'Alles für den Kita-Tag' })).toBeInTheDocument()
    const back = screen.getByRole('link', { name: 'Zur Anmeldung' })
    const form = screen.getByRole('form', { name: 'Anmelden' })
    expect(back).toHaveAttribute('href', `#${form.id}`)
  })
})

describe('the Kita’s name', () => {
  it('shows the Kita’s name and logo beside BournKita, and in the welcome', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': loggedOut,
      'GET /api/kita': { status: 200, body: { name: 'Kita Sonnenschein', hasLogo: true } },
    })
    renderAt('/', <App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'BournKita' })).toBeInTheDocument()
    expect(await screen.findByText('Kita Sonnenschein')).toBeInTheDocument()
    // In the header and in the welcome.
    const logos = screen.getAllByRole('img', { name: 'Logo of Kita Sonnenschein' })
    expect(logos.map((logo) => logo.getAttribute('src'))).toEqual(['/api/kita/logo', '/api/kita/logo'])
    expect(screen.getByText('Welcome to Kita Sonnenschein')).toBeInTheDocument()
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
