// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, noProfileLists, renderAt, sessionAs } from './testing'

const monkeys = { id: 2, name: 'Monkeys', icon: 'monkey' }
const peanuts = { id: 21, kind: 'allergy', name: 'Peanuts', note: '' }
const notYet = { alerts: [], attendance: null, absence: null, birthdayToday: false }
const lena = { id: 7, firstName: 'Lena', lastName: 'Müller', ...notYet, alerts: [peanuts], birthdayToday: true }
const mia = {
  id: 8,
  firstName: 'Mia',
  lastName: 'Müller',
  ...notYet,
  attendance: { checkedInAt: '2027-01-04T07:12:00Z', checkedOutAt: null },
}
const emil = {
  id: 9,
  firstName: 'Emil',
  lastName: 'Schmidt',
  ...notYet,
  attendance: { checkedInAt: '2027-01-04T07:05:00Z', checkedOutAt: '2027-01-04T11:30:00Z' },
}
const ida = {
  id: 10,
  firstName: 'Ida',
  lastName: 'Weber',
  ...notYet,
  absence: { id: 31, startsOn: '2027-01-04', endsOn: '2027-01-06', reason: 'sick' },
}

// A Child as the fake API holds it: any of the fields a Today view has.
type Child = { id: number; [field: string]: unknown }

/** The fake API of the Monkeys' Today view on Monday 4 January 2027, keeping its Children. */
function todayApi(children: Child[], routes: Record<string, (body: unknown) => { status: number; body?: unknown }> = {}) {
  const state = { children }
  const calls = fakeApi({
    'GET /api/health': health,
    'GET /api/session': sessionAs('teacher'),
    'GET /api/groups/2': () => ({ status: 200, body: { ...monkeys, day: '2027-01-04', children: state.children } }),
    ...Object.fromEntries(Object.entries(routes).map(([route, handler]) => [route, (body: unknown) => handler(body)])),
  })
  return { calls, state }
}

function card(name: string) {
  return screen.getByRole('listitem', { name })
}

describe('Today view', () => {
  it('shows each Child’s day, the alerts and whose birthday it is', async () => {
    todayApi([emil, ida, lena, mia])
    renderAt('/groups/2', <App />)

    expect(await screen.findByRole('heading', { name: 'Today, Monday, 4 January' })).toBeInTheDocument()
    expect(screen.getByText('Birthday today: Lena Müller')).toBeInTheDocument()
    expect(screen.getByText('Here 1 · Gone home 1 · Absent 1 · Not here yet 1')).toBeInTheDocument()
    expect(card('Lena Müller')).toHaveTextContent('Not here yet')
    expect(card('Lena Müller')).toHaveTextContent('Alerts: Peanuts')
    expect(card('Mia Müller')).toHaveTextContent('Here since 08:12')
    expect(card('Emil Schmidt')).toHaveTextContent('Gone home at 12:30')
    expect(card('Ida Weber')).toHaveTextContent('Absent: Sick, until Wednesday, 6 January')
    // Only what fits each: no checking in someone absent or gone.
    expect(within(card('Ida Weber')).queryByRole('button', { name: 'Check in Ida Weber' })).toBeNull()
    expect(within(card('Emil Schmidt')).queryByRole('button', { name: /Check/ })).toBeNull()
  })

  it('checks a Child in and out with one tap each, and undoes a mistake', async () => {
    const { calls, state } = todayApi([lena], {
      'POST /api/children/7/attendance/check-in': () => {
        state.children = [{ ...lena, attendance: { checkedInAt: '2027-01-04T07:40:00Z', checkedOutAt: null } } as Child]
        return { status: 204 }
      },
      'POST /api/children/7/attendance/check-out': () => {
        state.children = [{ ...lena, attendance: { checkedInAt: '2027-01-04T07:40:00Z', checkedOutAt: '2027-01-04T14:00:00Z' } } as Child]
        return { status: 204 }
      },
      'POST /api/children/7/attendance/undo': () => {
        state.children = [{ ...lena, attendance: { checkedInAt: '2027-01-04T07:40:00Z', checkedOutAt: null } } as Child]
        return { status: 204 }
      },
    })
    renderAt('/groups/2', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Check in Lena Müller' }))
    expect(await within(card('Lena Müller')).findByText('Here since 08:40')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Check out Lena Müller' }))
    expect(await within(card('Lena Müller')).findByText('Gone home at 15:00')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Undo for Lena Müller' }))
    expect(await within(card('Lena Müller')).findByText('Here since 08:40')).toBeInTheDocument()
    expect(calls.map((call) => call.route)).toEqual(
      expect.arrayContaining(['POST /api/children/7/attendance/check-in', 'POST /api/children/7/attendance/check-out', 'POST /api/children/7/attendance/undo']),
    )
  })

  it('records an absence for some days, and removes one', async () => {
    const { calls, state } = todayApi([lena, ida], {
      'POST /api/children/7/absences': (body) => {
        const absence = { id: 32, ...(body as object) }
        state.children = [{ ...lena, absence } as Child, ida]
        return { status: 201, body: absence }
      },
      'DELETE /api/children/10/absences/31': () => {
        state.children = state.children.map((child) => (child.id === 10 ? { ...child, absence: null } : child))
        return { status: 204 }
      },
    })
    renderAt('/groups/2', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Absent: Lena Müller' }))
    const form = screen.getByRole('form', { name: 'Absence of Lena Müller' })
    expect(within(form).getByLabelText('From')).toHaveValue('2027-01-04')
    await userEvent.selectOptions(within(form).getByLabelText('Reason'), 'Holiday')
    await userEvent.clear(within(form).getByLabelText('Until'))
    await userEvent.type(within(form).getByLabelText('Until'), '2027-01-08')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await within(card('Lena Müller')).findByText('Absent: Holiday, until Friday, 8 January')).toBeInTheDocument()
    expect(calls).toContainEqual({
      route: 'POST /api/children/7/absences',
      body: { startsOn: '2027-01-04', endsOn: '2027-01-08', reason: 'holiday' },
    })

    await userEvent.click(screen.getByRole('button', { name: 'Remove the absence of Ida Weber' }))
    expect(await within(card('Ida Weber')).findByText('Not here yet')).toBeInTheDocument()
  })

  it('says why a step could not be done', async () => {
    todayApi([lena], { 'POST /api/children/7/attendance/check-in': () => ({ status: 409, body: { detail: 'already_checked_in' } }) })
    renderAt('/groups/2', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Check in Lena Müller' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('already checked in today')
  })

  it('lists a Child’s coming absences on their profile, where they can be removed', async () => {
    const holiday = { id: 33, startsOn: '2027-01-11', endsOn: '2027-01-15', reason: 'holiday' }
    let absences = [holiday]
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/children/7': () => ({
        status: 200,
        body: { id: 7, firstName: 'Lena', lastName: 'Müller', gender: null, languages: '', foodPreferences: '', interests: '', dateOfBirth: null, ...noProfileLists, absences },
      }),
      'DELETE /api/children/7/absences/33': () => {
        absences = []
        return { status: 204 }
      },
    })
    renderAt('/children/7', <App />)

    const section = await screen.findByRole('region', { name: 'Absences' })
    expect(section).toHaveTextContent('Holiday: Monday, 11 January – Friday, 15 January')
    await userEvent.click(within(section).getByRole('button', { name: 'Remove the absence from Monday, 11 January' }))

    expect(await within(section).findByText('No absences coming up.')).toBeInTheDocument()
    expect(calls.map((call) => call.route)).toContain('DELETE /api/children/7/absences/33')
  })
})
