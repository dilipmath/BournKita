// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const trip = {
  event: {
    id: 1,
    group: null,
    title: 'Trip to the farm',
    note: '',
    startsOn: '2027-01-11',
    endsOn: '2027-01-11',
    startTime: null,
    endTime: null,
    repeat: 'none',
    repeatEvery: 1,
    repeatUntil: null,
    remindDaysBefore: null,
  },
  startsOn: '2027-01-11',
  endsOn: '2027-01-11',
}

describe('Guests', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-01-13T09:00:00+01:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a Guest the Kita-wide calendar only, read-only', async () => {
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('guest'),
      'GET /api/calendar?from=2026-12-28&to=2027-01-31': { status: 200, body: { events: [trip], birthdays: [], holidays: [] } },
    })
    renderAt('/', <App />)

    await userEvent.click(await screen.findByRole('button', { name: /Trip to the farm/ }))

    const menu = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(menu).getAllByRole('link').map((link) => link.textContent)).toEqual(['Calendar'])
    expect(screen.queryByRole('button', { name: 'Add event' })).not.toBeInTheDocument()
    const details = screen.getByRole('region', { name: 'Trip to the farm' })
    expect(within(details).queryByRole('button', { name: /Change|Delete/ })).not.toBeInTheDocument()
    // Nothing a Guest is refused is asked for.
    expect(calls.map((call) => call.route).filter((route) => !route.startsWith('GET /api/calendar'))).toEqual([
      'GET /api/health',
      'GET /api/session',
    ])
  })

  it('lets an Admin give an account the Guest role', async () => {
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/staff': { status: 200, body: [] },
      'GET /api/groups': { status: 200, body: [] },
      'POST /api/staff': { status: 201, body: { id: 5, email: 'gast@kita.example', role: 'guest', status: 'invited', groupIds: [], emailSent: true } },
    })
    renderAt('/staff', <App />)

    await userEvent.type(await screen.findByLabelText('Email address'), 'gast@kita.example')
    await userEvent.selectOptions(screen.getByLabelText('Role of the new Staff member'), 'Guest')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(calls).toContainEqual({ route: 'POST /api/staff', body: { email: 'gast@kita.example', role: 'guest' } })
  })
})
