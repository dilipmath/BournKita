// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const day = (group: object) => ({ expected: 0, here: 0, gone: 0, absent: 0, notYet: 0, alertsHere: 0, birthdays: [], ...group })
const overview = {
  day: '2027-01-04',
  groups: [
    day({ id: 2, name: 'Monkeys', icon: 'monkey', mine: true, expected: 4, here: 1, gone: 1, absent: 1, notYet: 1, alertsHere: 1, birthdays: [{ id: 7, firstName: 'Lena', lastName: 'Müller' }] }),
    day({ id: 3, name: 'Bears', icon: 'bear', mine: false }),
  ],
  kita: {
    stillCheckedIn: 2,
    withoutGroup: [{ id: 9, firstName: 'Paul', lastName: 'Weber' }],
    incidentsToday: 1,
    closesAt: '16:30',
    stillHereAfterClosing: [
      { id: 8, firstName: 'Mia', lastName: 'Schmidt', groupId: 2 },
      { id: 9, firstName: 'Paul', lastName: 'Weber', groupId: null },
    ],
  },
}

describe('Kita overview', () => {
  it('is an Admin’s start page: each Group’s day, and the whole Kita’s', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('admin'), 'GET /api/overview': { status: 200, body: overview } })
    renderAt('/', <App />)

    expect(await screen.findByRole('heading', { name: /, admin@kita.example$/ })).toBeInTheDocument()
    expect(screen.getByText('Monday, 4 January')).toBeInTheDocument()
    const monkeys = screen.getByRole('link', { name: /Monkeys/ })
    expect(monkeys).toHaveAttribute('href', '/groups/2')
    expect(monkeys).toHaveTextContent('1 of 4 here · 1 gone home · 1 absent · 1 not here yet')
    expect(monkeys).toHaveTextContent('With allergies or medical conditions here: 1')
    expect(monkeys).toHaveTextContent('Birthday today: Lena Müller')
    expect(screen.getByRole('link', { name: /Bears/ })).toHaveTextContent('No Children in this Group')
    // Their own Groups first, as the API sends them.
    expect(screen.getAllByRole('link', { name: /Monkeys|Bears/ }).map((link) => link.getAttribute('href'))).toEqual(['/groups/2', '/groups/3'])

    const attention = screen.getByRole('region', { name: 'Needs attention' })
    const late = within(attention).getByRole('listitem', { name: 'Still here after closing time (16:30)' })
    expect(within(late).getByRole('link', { name: 'Mia Schmidt' })).toHaveAttribute('href', '/groups/2')
    // In no Group: their profile.
    expect(within(late).getByRole('link', { name: 'Paul Weber' })).toHaveAttribute('href', '/children/9')
    const noGroup = within(attention).getByRole('listitem', { name: 'In no Group' })
    expect(within(noGroup).getByRole('link', { name: 'Paul Weber' })).toHaveAttribute('href', '/children/9')
    expect(within(attention).getByRole('link', { name: 'Incidents today: 1' })).toHaveAttribute('href', '/incidents')
    // Good news, not a warning.
    expect(within(attention).getByRole('listitem', { name: 'Birthday today' })).toHaveTextContent('Lena Müller')
  })

  it('leaves out Needs attention when nothing does', async () => {
    const quiet = { stillCheckedIn: 0, withoutGroup: [], incidentsToday: 0, closesAt: '16:30', stillHereAfterClosing: [] }
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/overview': { status: 200, body: { ...overview, groups: [overview.groups[1]], kita: quiet } },
    })
    renderAt('/', <App />)

    await screen.findByRole('link', { name: /Bears/ })
    expect(screen.queryByRole('region', { name: 'Needs attention' })).toBeNull()
  })
})
