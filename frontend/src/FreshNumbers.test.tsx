// @vitest-environment happy-dom
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const monkeys = { id: 2, name: 'Monkeys', icon: 'monkey' }
const group = { ...monkeys, mine: true, expected: 1, here: 0, gone: 0, absent: 0, notYet: 1, alertsHere: 0, birthdays: [] }
const quiet = { stillCheckedIn: 0, withoutGroup: [], incidentsToday: 0, closesAt: null, stillHereAfterClosing: [] }
const overview = (here: number) => ({ day: '2027-01-04', groups: [{ ...group, here, notYet: 1 - here }], kita: quiet })
const lena = { id: 7, firstName: 'Lena', lastName: 'Müller', alerts: [], attendance: null, absence: null, birthdayToday: false, photoId: null }

function setVisible(visible: boolean) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (visible ? 'visible' : 'hidden') })
  document.dispatchEvent(new Event('visibilitychange'))
}

const minutes = (count: number) => act(() => vi.advanceTimersByTimeAsync(count * 60_000))

describe('fresh numbers', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // 09:00 at the Kita.
    vi.setSystemTime(new Date('2027-01-04T08:00:00Z'))
    setVisible(true)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reloads the Kita overview every 5 minutes and says when', async () => {
    let answers = 0
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/overview': () => ({ status: 200, body: overview(answers++ === 0 ? 0 : 1) }),
    })
    renderAt('/', <App />)

    expect(await screen.findByText('Updated 09:00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Monkeys/ })).toHaveTextContent('0 of 1 here')
    await minutes(5)

    expect(await screen.findByText('Updated 09:05')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Monkeys/ })).toHaveTextContent('1 of 1 here')
    expect(calls.filter((call) => call.route === 'GET /api/overview')).toHaveLength(2)
  })

  it('does not reload while the tablet is asleep, and does when it wakes up', async () => {
    const calls = fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('admin'), 'GET /api/overview': { status: 200, body: overview(0) } })
    renderAt('/', <App />)
    await screen.findByText('Updated 09:00')
    const overviewCalls = () => calls.filter((call) => call.route === 'GET /api/overview').length

    setVisible(false)
    await minutes(20)
    expect(overviewCalls()).toBe(1)

    await act(async () => setVisible(true))
    expect(await screen.findByText('Updated 09:20')).toBeInTheDocument()
    expect(overviewCalls()).toBe(2)
  })

  it('keeps the numbers when a refresh fails, and says so', async () => {
    let fail = false
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/overview': () => (fail ? { status: 500 } : { status: 200, body: overview(0) }),
    })
    renderAt('/', <App />)
    await screen.findByText('Updated 09:00')

    fail = true
    await minutes(5)

    expect(await screen.findByText('Could not update the numbers; these are from 09:00.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Monkeys/ })).toHaveTextContent('0 of 1 here')
  })

  it('refreshes the Today view without losing an open Absence form', async () => {
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/groups/2': { status: 200, body: { ...monkeys, day: '2027-01-04', children: [lena] } },
    })
    renderAt('/groups/2', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Absent: Lena Müller' }))
    const form = screen.getByRole('form', { name: 'Absence of Lena Müller' })
    await userEvent.selectOptions(within(form).getByLabelText('Reason'), 'Holiday')
    await minutes(5)

    expect(await screen.findByText('Updated 09:05')).toBeInTheDocument()
    expect(calls.filter((call) => call.route === 'GET /api/groups/2')).toHaveLength(2)
    expect(within(screen.getByRole('form', { name: 'Absence of Lena Müller' })).getByLabelText('Reason')).toHaveValue('holiday')
  })
})
