// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const day = (group: object) => ({ mine: true, expected: 0, here: 0, gone: 0, absent: 0, notYet: 0, alertsHere: 0, birthdays: [], ...group })
const monkeys = day({ id: 2, name: 'Monkeys', icon: 'monkey', expected: 4, here: 2, gone: 1, absent: 0, notYet: 1 })
const bears = day({ id: 3, name: 'Bears', icon: 'bear', mine: false, expected: 3, here: 1, gone: 0, absent: 1, notYet: 1 })
const kita = { stillCheckedIn: 3, withoutGroup: [], incidentsToday: 0 }
const aylin = { ...sessionAs('admin'), body: { ...sessionAs('admin').body, displayName: 'Aylin' } }

describe('the page after login', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // 09:00 at the Kita.
    vi.setSystemTime(new Date('2027-01-04T08:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('greets an Admin by name, with the date and the whole Kita’s day as a bar', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': aylin, 'GET /api/overview': { status: 200, body: { day: '2027-01-04', groups: [monkeys, bears], kita } } })
    renderAt('/', <App />)

    const header = await screen.findByRole('region', { name: 'Good morning, Aylin' })
    expect(header).toHaveTextContent('Monday, 4 January')
    // The Groups' Children together.
    expect(header).toHaveTextContent('3 of 7 here · 1 gone home · 1 absent · 2 not here yet')
  })

  it('greets a Teacher with several Groups by email without a display name, without the Kita’s bar', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/overview/mine': { status: 200, body: { day: '2027-01-04', groups: [monkeys, { ...bears, mine: true }] } },
    })
    renderAt('/', <App />)

    const header = await screen.findByRole('region', { name: 'Good morning, teacher@kita.example' })
    expect(header).toHaveTextContent('Monday, 4 January')
    expect(within(header).queryByText(/of 7 here/)).toBeNull()
    expect(screen.getByRole('link', { name: /Monkeys/ })).toBeInTheDocument()
  })

  it('keeps the page’s shape while the numbers load', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': aylin })
    vi.stubGlobal('fetch', ((original) => (url: string, init?: RequestInit) =>
      url === '/api/overview' ? new Promise<Response>(() => undefined) : original(url, init))(fetch))
    renderAt('/', <App />)

    const loading = await screen.findByRole('region', { name: 'Loading today' })
    expect(loading).toHaveAttribute('aria-busy', 'true')
  })

  it('shows an Admin with no Groups how to start', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': aylin, 'GET /api/overview': { status: 200, body: { day: '2027-01-04', groups: [], kita } } })
    renderAt('/', <App />)

    expect(await screen.findByText('No Groups yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create the first Group' })).toHaveAttribute('href', '/groups')
  })
})
