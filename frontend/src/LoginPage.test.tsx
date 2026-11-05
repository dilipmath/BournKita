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
    expect(screen.queryByRole('heading', { name: /Good/ })).toBeNull()
  })
})
