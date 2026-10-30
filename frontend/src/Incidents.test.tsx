// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { fakeApi, health, noProfileLists, renderAt, sessionAs } from './testing'

const monkeys = { id: 2, name: 'Monkeys', icon: 'monkey', mine: true }
const lenaChild = { id: 7, firstName: 'Lena', lastName: 'Müller' }
const fall = {
  id: 51,
  child: lenaChild,
  happenedOn: '2027-01-04',
  happenedAt: '10:15:00',
  description: 'Fell off the slide, grazed her knee.',
  informed: 'Mother, by phone',
  reportedBy: 'teacher@kita.example',
  reportedAt: '2027-01-04T09:20:00Z',
  followUps: [],
}
const todayLena = { ...lenaChild, alerts: [], attendance: null, absence: null, birthdayToday: false }

describe('Incident log', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-01-04T10:00:00+01:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('lets a Teacher report an incident from a Child’s card in the Today view', async () => {
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/groups/2': { status: 200, body: { ...monkeys, day: '2027-01-04', children: [todayLena] } },
      'POST /api/children/7/incidents': { status: 201, body: fall },
    })
    renderAt('/groups/2', <App />)

    const card = await screen.findByRole('listitem', { name: 'Lena Müller' })
    await userEvent.click(within(card).getByRole('button', { name: 'Report incident: Lena Müller' }))
    const form = within(card).getByRole('form', { name: 'Incident of Lena Müller' })
    expect(within(form).getByLabelText('Date')).toHaveValue('2027-01-04')
    await userEvent.type(within(form).getByLabelText('Time (if known)'), '10:15')
    await userEvent.type(within(form).getByLabelText('What happened'), 'Fell off the slide, grazed her knee.')
    await userEvent.type(within(form).getByLabelText('Who was informed'), 'Mother, by phone')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await within(card).findByRole('status')).toHaveTextContent('Incident reported.')
    expect(calls).toContainEqual({
      route: 'POST /api/children/7/incidents',
      body: { happenedOn: '2027-01-04', happenedAt: '10:15', description: 'Fell off the slide, grazed her knee.', informed: 'Mother, by phone' },
    })
  })

  it('lets staff report an incident from the Child profile, saying what is missing', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/children/7': { status: 200, body: { ...lenaChild, gender: null, languages: '', foodPreferences: '', interests: '', dateOfBirth: null, ...noProfileLists } },
      'POST /api/children/7/incidents': { status: 422, body: { detail: 'informed_required' } },
    })
    renderAt('/children/7', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Report incident: Lena Müller' }))
    const form = screen.getByRole('form', { name: 'Incident of Lena Müller' })
    await userEvent.type(within(form).getByLabelText('What happened'), 'Bumped her head.')
    await userEvent.type(within(form).getByLabelText('Who was informed'), ' ')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Say who was informed')
  })

  it('lets an Admin filter the log and add a follow-up', async () => {
    let followUps: unknown[] = []
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/groups': { status: 200, body: [monkeys] },
      'GET /api/children?search=': { status: 200, body: [lenaChild] },
      'GET /api/incidents': () => ({ status: 200, body: [{ ...fall, followUps }] }),
      'GET /api/incidents?childId=7&since=2027-01-01': () => ({ status: 200, body: [{ ...fall, followUps }] }),
      'POST /api/incidents/51/follow-ups': (body) => {
        followUps = [{ id: 61, note: (body as { note: string }).note, author: 'admin@kita.example', at: '2027-01-04T10:00:00Z' }]
        return { status: 201, body: followUps[0] }
      },
    })
    renderAt('/incidents', <App />)

    const entry = await screen.findByRole('article', { name: 'Lena Müller, Monday, 4 January 2027' })
    expect(entry).toHaveTextContent('10:15')
    expect(entry).toHaveTextContent('Fell off the slide, grazed her knee.')
    expect(entry).toHaveTextContent('Informed: Mother, by phone')
    expect(entry).toHaveTextContent('Reported by teacher@kita.example')

    const filters = screen.getByRole('search', { name: 'Filter the incident log' })
    await userEvent.selectOptions(within(filters).getByLabelText('Child'), 'Lena Müller')
    await userEvent.type(within(filters).getByLabelText('From'), '2027-01-01')
    await userEvent.click(within(filters).getByRole('button', { name: 'Show' }))
    await vi.waitFor(() => expect(calls.map((call) => call.route)).toContain('GET /api/incidents?childId=7&since=2027-01-01'))

    const shown = await screen.findByRole('article', { name: 'Lena Müller, Monday, 4 January 2027' })
    await userEvent.type(within(shown).getByLabelText('Follow-up'), 'Parents called back, all fine.')
    await userEvent.click(within(shown).getByRole('button', { name: 'Add follow-up' }))
    expect(await within(screen.getByRole('article')).findByText('Parents called back, all fine.')).toBeInTheDocument()
  })

  it('shows Teachers the incidents they reported, without follow-up forms', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/groups': { status: 200, body: [monkeys] },
      'GET /api/children?search=': { status: 200, body: [lenaChild] },
      'GET /api/incidents': { status: 200, body: [fall] },
    })
    renderAt('/incidents', <App />)

    expect(await screen.findByText('The incidents you reported.')).toBeInTheDocument()
    const entry = await screen.findByRole('article', { name: 'Lena Müller, Monday, 4 January 2027' })
    expect(within(entry).queryByLabelText('Follow-up')).toBeNull()
  })
})
