// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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

function profileOf(child: Child, lists: Record<string, unknown[]> = {}) {
  return {
    status: 200,
    body: { gender: null, languages: '', foodPreferences: '', interests: '', dateOfBirth: null, ...child, ...noProfileLists, ...lists },
  }
}

/** The fake API of the Monkeys' Today view on Monday 4 January 2027, keeping its Children. */
function todayApi(children: Child[], routes: Record<string, (body: unknown) => { status: number; body?: unknown }> = {}) {
  const state = { children }
  const calls = fakeApi({
    'GET /api/health': health,
    'GET /api/session': sessionAs('teacher'),
    'GET /api/groups/2': () => ({ status: 200, body: { ...monkeys, day: '2027-01-04', children: state.children } }),
    // Who may pick each Child up, for checking out: nobody, unless a test says otherwise.
    ...Object.fromEntries(children.map((child) => [`GET /api/children/${child.id}`, profileOf(child)])),
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
    // Each tag: first name and initial, and the state in words.
    expect(card('Lena Müller')).toHaveTextContent('Lena M.')
    expect(card('Lena Müller')).toHaveTextContent('Not here yet')
    expect(card('Lena Müller')).toHaveTextContent('Alerts: Peanuts')
    // The tap says what it does; the state and the allergen are read after it.
    expect(screen.getByRole('button', { name: 'Check in Lena Müller' })).toHaveAccessibleDescription('Not here yet Alerts: Peanuts')
    expect(card('Mia Müller')).toHaveTextContent('Here 08:12')
    expect(card('Emil Schmidt')).toHaveTextContent('Gone home 12:30')
    expect(card('Ida Weber')).toHaveTextContent('Absent: Sick, until Wednesday, 6 January')
    // Only what fits each: an absent tag is not tappable, a gone one does not check in again.
    expect(within(card('Ida Weber')).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Remove the absence of Ida Weber',
      'More for Ida Weber',
    ])
    expect(within(card('Emil Schmidt')).queryByRole('button', { name: /Check/ })).toBeNull()
  })

  it('sums up the day: how many are here, one dot per Child, and today’s Birthdays', async () => {
    const sam = { ...notYet, id: 11, firstName: 'Sam', lastName: 'Kurz', attendance: { checkedInAt: '2027-01-04T07:30:00Z', checkedOutAt: null } }
    todayApi([emil, ida, lena, mia, sam])
    renderAt('/groups/2', <App />)

    const strip = await screen.findByRole('region', { name: 'Today in numbers' })
    expect(strip).toHaveTextContent('2 of 5 Children are here')
    // The dots are a picture; a screen reader gets the same as a sentence.
    expect(within(strip).getByRole('img', { name: '2 of 5 here, 1 gone home, 1 absent, 1 not here yet.' })).toBeInTheDocument()
    expect(strip).toHaveTextContent('1 not here yet')
    expect(strip).toHaveTextContent('1 absent')
    expect(strip).toHaveTextContent('1 gone home')
    expect(strip).toHaveTextContent('Birthday today: Lena Müller')
  })

  it('puts the allergy bar first: who has an Alert and is here or still to come, with the allergen', async () => {
    const asthma = { id: 22, kind: 'condition', name: 'Asthma', note: 'Inhaler in the bag' }
    const eggs = { id: 23, kind: 'allergy', name: 'Eggs', note: '' }
    todayApi([
      { ...emil, alerts: [eggs] },
      { ...ida, alerts: [eggs] },
      { ...lena, symbol: 'kite' },
      { ...mia, alerts: [asthma, eggs] },
    ])
    renderAt('/groups/2', <App />)

    const bar = await screen.findByRole('region', { name: 'Allergies and medical conditions today' })
    expect(within(bar).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Lena Müller Peanuts', 'Mia Müller Asthma, Eggs'])
    expect(within(bar).getByLabelText('Kite')).toBeInTheDocument()
    // Above the board.
    expect(bar.compareDocumentPosition(card('Lena Müller')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('checks a Child in with one tap on their name tag, and the toast’s Undo takes it back', async () => {
    const checkedIn = { ...lena, attendance: { checkedInAt: '2027-01-04T07:48:00Z', checkedOutAt: null } } as Child
    const { calls, state } = todayApi([lena], {
      'POST /api/children/7/attendance/check-in': () => {
        state.children = [checkedIn]
        return { status: 204 }
      },
      'POST /api/children/7/attendance/undo': () => {
        state.children = [lena]
        return { status: 204 }
      },
    })
    renderAt('/groups/2', <App />)

    // The whole tag is the button.
    await userEvent.click(await screen.findByRole('button', { name: 'Check in Lena Müller' }))

    expect(await within(card('Lena Müller')).findByText('Here 08:48')).toBeInTheDocument()
    const toast = await screen.findByText('Lena is here (08:48)')
    // Said in the polite live region too.
    expect(toast.closest('[aria-live="polite"]')).not.toBeNull()
    await userEvent.click(within(toast.parentElement!).getByRole('button', { name: 'Undo' }))
    expect(await within(card('Lena Müller')).findByText('Not here yet')).toBeInTheDocument()
    expect(calls.map((call) => call.route)).toContain('POST /api/children/7/attendance/undo')
  })

  it('confirms a check-in with Undo even while showing only who is not here yet', async () => {
    const { state } = todayApi([lena], {
      'POST /api/children/7/attendance/check-in': () => {
        state.children = [{ ...lena, attendance: { checkedInAt: '2027-01-04T07:48:00Z', checkedOutAt: null } } as Child]
        return { status: 204 }
      },
      'POST /api/children/7/attendance/undo': () => {
        state.children = [lena]
        return { status: 204 }
      },
    })
    renderAt('/groups/2', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Show only who is not here yet' }))
    await userEvent.click(screen.getByRole('button', { name: 'Check in Lena Müller' }))

    // Her tag leaves the list, but the toast stays to take it back.
    const toast = await screen.findByText('Lena is here (08:48)')
    await userEvent.click(within(toast.parentElement!).getByRole('button', { name: 'Undo' }))
    expect(await screen.findByRole('button', { name: 'Check in Lena Müller' })).toBeInTheDocument()
  })

  it('checks a Child out through the pick-up check, and undoes it later from their tag', async () => {
    const { calls, state } = todayApi([{ ...lena, attendance: { checkedInAt: '2027-01-04T07:40:00Z', checkedOutAt: null } } as Child], {
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

    await userEvent.click(await screen.findByRole('button', { name: 'Check out Lena Müller' }))
    // Not yet: first who may pick her up.
    expect(calls.map((call) => call.route)).not.toContain('POST /api/children/7/attendance/check-out')
    await userEvent.click(await screen.findByRole('button', { name: 'Lena Müller goes home now' }))
    expect(await within(card('Lena Müller')).findByText('Gone home 15:00')).toBeInTheDocument()
    expect(await screen.findByText('Lena went home (15:00)')).toBeInTheDocument()

    // Long after the toast: a tap on the tag shows Undo.
    await userEvent.click(screen.getByRole('button', { name: 'Lena Müller has gone home: show Undo' }))
    await userEvent.click(within(card('Lena Müller')).getByRole('button', { name: 'Undo for Lena Müller' }))
    expect(await within(card('Lena Müller')).findByText('Here 08:40')).toBeInTheDocument()
    expect(calls.map((call) => call.route)).toContain('POST /api/children/7/attendance/undo')
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
    expect(screen.queryByRole('button', { name: 'Check in Lena Müller' })).toBeNull()
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

describe('Today tiles', () => {
  it('shows each Child’s Symbol, never a photo', async () => {
    todayApi([{ ...lena, symbol: 'kite' }, { ...mia, symbol: 'boat' }])
    renderAt('/groups/2', <App />)

    const lenaCard = await screen.findByRole('listitem', { name: 'Lena Müller' })
    // Beside the name, so not read out again.
    expect(within(lenaCard).getByLabelText('Kite')).toHaveAttribute('aria-hidden', 'true')
    expect(within(card('Mia Müller')).getByLabelText('Boat')).toBeInTheDocument()
    expect(within(lenaCard).queryByRole('img', { name: /Photo/ })).toBeNull()
  })

  it('shows who may pick the Child up before checking them out', async () => {
    
    const oma = { id: 51, name: 'Oma Gisela', relationship: 'Grandmother', phone: '', note: '', photoId: 61 }
    const papa = { id: 52, firstName: 'Jonas', lastName: 'Müller', mayPickUp: true, photoId: null }
    const { calls } = todayApi([mia], {
      'GET /api/children/8': () => profileOf(mia, { pickUpPersons: [oma], parents: [papa] }),
      'POST /api/children/8/attendance/check-out': () => ({ status: 204 }),
    })
    renderAt('/groups/2', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Check out Mia Müller' }))

    const pickUp = await screen.findByRole('region', { name: 'Who may pick up Mia Müller' })
    expect(pickUp).toHaveTextContent('Jonas Müller')
    expect(pickUp).toHaveTextContent('Oma Gisela (Grandmother)')
    expect(within(pickUp).getByRole('img', { name: 'Photo of Oma Gisela' })).toBeInTheDocument()
    expect(calls.map((call) => call.route)).not.toContain('POST /api/children/8/attendance/check-out')

    await userEvent.click(within(pickUp).getByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('region', { name: 'Who may pick up Mia Müller' })).toBeNull()
  })

  it('opens the Child’s profile from their tag’s menu', async () => {
    todayApi([lena])
    renderAt('/groups/2', <App />)

    const more = await screen.findByRole('button', { name: 'More for Lena Müller' })
    expect(screen.queryByRole('link', { name: 'Profile of Lena Müller' })).toBeNull()
    await userEvent.click(more)

    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Profile of Lena Müller' })).toHaveAttribute('href', '/children/7')
  })

  it('shows only the Children not here yet when asked', async () => {
    todayApi([emil, ida, lena, mia])
    renderAt('/groups/2', <App />)

    const filter = await screen.findByRole('button', { name: 'Show only who is not here yet' })
    await userEvent.click(filter)

    expect(filter).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('list', { name: 'The Children’s name tags' })).getAllByRole('listitem').map((item) => item.getAttribute('aria-label'))).toEqual(['Lena Müller'])
    await userEvent.click(filter)
    expect(within(screen.getByRole('list', { name: 'The Children’s name tags' })).getAllByRole('listitem')).toHaveLength(4)
  })
})

describe('Today view while loading', () => {
  it('keeps the page’s shape instead of saying Loading…', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('teacher') })
    vi.stubGlobal('fetch', ((original) => (url: string, init?: RequestInit) =>
      url === '/api/groups/2' ? new Promise<Response>(() => undefined) : original(url, init))(fetch))
    renderAt('/groups/2', <App />)

    expect(await screen.findByRole('region', { name: 'Loading today' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Loading…')).toBeNull()
  })
})
