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
  kita: { stillCheckedIn: 2, withoutGroup: [{ id: 9, firstName: 'Paul', lastName: 'Weber' }], incidentsToday: 1 },
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

    const kita = screen.getByRole('region', { name: 'The whole Kita' })
    expect(kita).toHaveTextContent('Still checked in: 2')
    expect(within(kita).getByRole('link', { name: 'Paul Weber' })).toHaveAttribute('href', '/children/9')
    expect(within(kita).getByRole('link', { name: 'Incidents today: 1' })).toHaveAttribute('href', '/incidents')
  })

  it('says when every Child has a Group', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/overview': { status: 200, body: { ...overview, kita: { stillCheckedIn: 0, withoutGroup: [], incidentsToday: 0 } } },
    })
    renderAt('/', <App />)

    const kita = await screen.findByRole('region', { name: 'The whole Kita' })
    expect(kita).toHaveTextContent('Every Child is in a Group.')
    expect(kita).toHaveTextContent('Incidents today: 0')
  })
})
