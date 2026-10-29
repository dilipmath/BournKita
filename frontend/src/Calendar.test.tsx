// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const monkeys = { id: 2, name: 'Monkeys', icon: 'monkey' }
const repeatsNot = { repeat: 'none', repeatEvery: 1, repeatUntil: null, remindDaysBefore: null }
const trip = {
  id: 41,
  group: monkeys,
  title: 'Trip to the farm',
  note: 'Bring boots',
  startsOn: '2027-01-11',
  endsOn: '2027-01-12',
  startTime: null,
  endTime: null,
  ...repeatsNot,
}
const evening = {
  id: 42,
  group: null,
  title: "Parents' evening",
  note: '',
  startsOn: '2027-01-13',
  endsOn: '2027-01-13',
  startTime: '18:00:00',
  endTime: '20:00:00',
  ...repeatsNot,
}
const music = {
  id: 43,
  group: null,
  title: 'Music',
  note: '',
  startsOn: '2027-01-04',
  endsOn: '2027-01-04',
  startTime: '10:00:00',
  endTime: '10:45:00',
  repeat: 'weekly',
  repeatEvery: 1,
  repeatUntil: null,
  remindDaysBefore: 1,
}

function occurrence(event: typeof trip | typeof evening | typeof music, startsOn = event.startsOn, endsOn = event.endsOn) {
  return { event, startsOn, endsOn }
}

const january = [occurrence(trip), occurrence(music, '2027-01-11', '2027-01-11'), occurrence(evening), occurrence(music, '2027-01-18', '2027-01-18')]

/** A reply for the Calendar: these occurrences, and birthdays and holidays if given. */
function span(events: unknown[] = [], more: { birthdays?: unknown[]; holidays?: unknown[] } = {}) {
  return { events, birthdays: [], holidays: [], ...more }
}

function calendarApi(extra: Record<string, unknown> = {}) {
  return fakeApi({
    'GET /api/health': health,
    'GET /api/session': sessionAs('teacher'),
    'GET /api/groups': { status: 200, body: [{ ...monkeys, mine: true }] },
    'GET /api/calendar?from=2026-12-28&to=2027-01-31': { status: 200, body: span(january) },
    ...(extra as Record<string, { status: number; body?: unknown }>),
  })
}

describe('Calendar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // Wednesday 13 January 2027.
    vi.setSystemTime(new Date('2027-01-13T09:00:00+01:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('shows this month, Monday first, with every day an event touches', async () => {
    calendarApi()
    renderAt('/calendar', <App />)

    expect(await screen.findByRole('heading', { name: 'Calendar: whole Kita' })).toBeInTheDocument()
    const month = await screen.findByRole('table', { name: 'January 2027' })
    expect(within(month).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    const day = (date: string) => within(month).getByRole('cell', { name: date })
    // The trip spans two days; Music repeats weekly.
    expect(day('11 January')).toHaveTextContent('Trip to the farm')
    expect(day('12 January')).toHaveTextContent('Trip to the farm')
    expect(day('11 January')).toHaveTextContent('10:00 Music')
    expect(day('13 January')).toHaveTextContent("18:00 Parents' evening")
    expect(day('18 January')).toHaveTextContent('Music')
    // Days of the weeks around the month are shown too.
    expect(day('28 December')).toBeInTheDocument()
  })

  it('moves through months, weeks and the agenda', async () => {
    const calls = calendarApi({
      'GET /api/calendar?from=2027-02-01&to=2027-02-28': { status: 200, body: span([]) },
      'GET /api/calendar?from=2027-01-11&to=2027-01-17': { status: 200, body: span(january.slice(0, 3)) },
      'GET /api/calendar?from=2027-01-13&to=2027-02-11': { status: 200, body: span(january.slice(2)) },
      'GET /api/calendar?from=2027-02-12&to=2027-03-13': { status: 200, body: span([]) },
    })
    renderAt('/calendar', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('table', { name: 'February 2027' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(await screen.findByRole('table', { name: 'January 2027' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Week' }))
    const monday = await screen.findByRole('region', { name: 'Monday, 11 January' })
    expect(within(monday).getAllByRole('button').map((button) => button.textContent)).toEqual(['🐒 Monkeys: Trip to the farm', '10:00–10:45 Music'])
    expect(screen.getByRole('region', { name: 'Sunday, 17 January' })).toHaveTextContent('Nothing on.')

    await userEvent.click(screen.getByRole('button', { name: 'Agenda' }))
    // From today, the days that have something on.
    expect(await screen.findByRole('region', { name: 'Wednesday, 13 January' })).toHaveTextContent("Parents' evening")
    expect(screen.getByRole('region', { name: 'Monday, 18 January' })).toHaveTextContent('Music')
    expect(screen.queryByRole('region', { name: 'Thursday, 14 January' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Nothing on in these 30 days.')).toBeInTheDocument()
    expect(calls.map((call) => call.route)).toContain('GET /api/calendar?from=2027-02-12&to=2027-03-13')
  })

  it('shows a Group’s calendar, reached from its dashboard', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/groups': { status: 200, body: [{ ...monkeys, mine: true }] },
      'GET /api/groups/2': { status: 200, body: { ...monkeys, children: [] } },
      'GET /api/calendar?from=2026-12-28&to=2027-01-31&groupId=2': { status: 200, body: span(january) },
    })
    renderAt('/groups/2', <App />)

    const groupPages = await screen.findByRole('navigation', { name: 'The Group’s pages' })
    await userEvent.click(within(groupPages).getByRole('link', { name: 'Calendar' }))

    expect(await screen.findByRole('heading', { name: 'Calendar: Monkeys' })).toBeInTheDocument()
    expect(await screen.findByRole('table', { name: 'January 2027' })).toBeInTheDocument()
  })

  it('lets staff add a weekly event', async () => {
    const calls = calendarApi({ 'POST /api/events': { status: 201, body: music } })
    renderAt('/calendar', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Add event' }))
    const form = screen.getByRole('form', { name: 'Add event' })
    await userEvent.type(within(form).getByLabelText('Title'), 'Music')
    await userEvent.selectOptions(within(form).getByLabelText('For'), '🐒 Monkeys')
    await userEvent.click(within(form).getByLabelText('All day'))
    await userEvent.clear(within(form).getByLabelText('Starts on'))
    await userEvent.type(within(form).getByLabelText('Starts on'), '2027-01-18')
    await userEvent.type(within(form).getByLabelText('Start time'), '10:00')
    await userEvent.type(within(form).getByLabelText('End time'), '10:45')
    await userEvent.selectOptions(within(form).getByLabelText('Repeats'), 'Every week')
    await userEvent.clear(within(form).getByLabelText('Every how many weeks'))
    await userEvent.type(within(form).getByLabelText('Every how many weeks'), '2')
    await userEvent.type(within(form).getByLabelText('Repeats until (optional)'), '2027-07-15')
    await userEvent.selectOptions(within(form).getByLabelText('Reminder'), '1 day before')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(calls).toContainEqual({
      route: 'POST /api/events',
      body: {
        groupId: 2,
        title: 'Music',
        note: '',
        startsOn: '2027-01-18',
        endsOn: '2027-01-18',
        startTime: '10:00',
        endTime: '10:45',
        repeat: 'weekly',
        repeatEvery: 2,
        repeatUntil: '2027-07-15',
        remindDaysBefore: 1,
      },
    })
    expect(screen.queryByRole('form', { name: 'Add event' })).toBeNull()
  })

  it('shows this month when the address names no valid day', async () => {
    calendarApi()
    renderAt('/calendar?view=month&day=not-a-day', <App />)

    expect(await screen.findByRole('table', { name: 'January 2027' })).toBeInTheDocument()
  })

  it('starts a new event on a day being looked at, and keeps its end from coming before its start', async () => {
    calendarApi({ 'GET /api/calendar?from=2027-03-01&to=2027-03-07': { status: 200, body: span([]) } })
    renderAt('/calendar?view=week&day=2027-03-03', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Add event' }))
    const form = screen.getByRole('form', { name: 'Add event' })
    // That week's Monday, not today (13 January).
    expect(within(form).getByLabelText('Starts on')).toHaveValue('2027-03-01')
    await userEvent.clear(within(form).getByLabelText('Starts on'))
    await userEvent.type(within(form).getByLabelText('Starts on'), '2027-03-05')
    expect(within(form).getByLabelText('Ends on')).toHaveValue('2027-03-05')
  })

  it('names each event’s Group in the Kita-wide calendar', async () => {
    calendarApi()
    renderAt('/calendar', <App />)

    const month = await screen.findByRole('table', { name: 'January 2027' })
    expect(within(within(month).getByRole('cell', { name: '11 January' })).getByRole('button', { name: 'Monkeys: Trip to the farm' })).toBeInTheDocument()
  })

  it('shows an event’s details and lets staff change or delete it', async () => {
    const calls = calendarApi({
      'PUT /api/events/43': { status: 200, body: { ...music, title: 'Singing' } },
      'DELETE /api/events/43': { status: 204 },
    })
    renderAt('/calendar', <App />)

    const month = await screen.findByRole('table', { name: 'January 2027' })
    await userEvent.click(within(within(month).getByRole('cell', { name: '11 January' })).getByRole('button', { name: /Music/ }))
    const details = screen.getByRole('region', { name: 'Music' })
    expect(details).toHaveTextContent('Every week')
    expect(details).toHaveTextContent('10:00–10:45')
    expect(details).toHaveTextContent('Whole Kita')
    expect(details).toHaveTextContent('Reminder: 1 day before')

    await userEvent.click(within(details).getByRole('button', { name: 'Change Music' }))
    const form = within(details).getByRole('form', { name: 'Change Music' })
    await userEvent.clear(within(form).getByLabelText('Title'))
    await userEvent.type(within(form).getByLabelText('Title'), 'Singing')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))
    expect(calls).toContainEqual(expect.objectContaining({ route: 'PUT /api/events/43', body: expect.objectContaining({ title: 'Singing', startsOn: '2027-01-04', repeat: 'weekly' }) }))

    await userEvent.click(within(month).getAllByRole('button', { name: /Music/ })[0])
    await userEvent.click(within(screen.getByRole('region', { name: 'Music' })).getByRole('button', { name: 'Delete Music' }))
    // It repeats: deleting takes every occurrence.
    const confirm = screen.getByRole('group', { name: 'Delete Music' })
    expect(confirm).toHaveTextContent('Really delete “Music”, every time it happens?')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
    expect(calls.map((call) => call.route)).toContain('DELETE /api/events/43')
  })

  it('shows Children’s birthdays and the holidays', async () => {
    const birthdays = [{ childId: 7, firstName: 'Lena', lastName: 'Müller', on: '2027-01-14' }]
    const holidays = [
      { kind: 'public', name: 'Neujahr', startsOn: '2027-01-01', endsOn: '2027-01-01' },
      { kind: 'school', name: 'Winterferien', startsOn: '2027-01-25', endsOn: '2027-01-27' },
    ]
    calendarApi({
      'GET /api/calendar?from=2026-12-28&to=2027-01-31': { status: 200, body: span(january, { birthdays, holidays }) },
      'GET /api/calendar?from=2027-01-13&to=2027-02-11': { status: 200, body: span([], { birthdays, holidays }) },
    })
    renderAt('/calendar', <App />)

    const month = await screen.findByRole('table', { name: 'January 2027' })
    const day = (date: string) => within(month).getByRole('cell', { name: date })
    // A birthday leads to the Child's profile.
    expect(within(day('14 January')).getByRole('link', { name: 'Birthday: Lena Müller' })).toHaveAttribute('href', '/children/7')
    expect(day('1 January')).toHaveTextContent('Neujahr')
    expect(day('26 January')).toHaveTextContent('Winterferien')

    await userEvent.click(screen.getByRole('button', { name: 'Agenda' }))
    // Days with only a birthday or a holiday are listed too.
    expect(await screen.findByRole('region', { name: 'Thursday, 14 January' })).toHaveTextContent('Lena Müller')
    expect(screen.getByRole('region', { name: 'Tuesday, 26 January' })).toHaveTextContent('Winterferien')
  })
})
