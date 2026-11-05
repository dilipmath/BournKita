// @vitest-environment happy-dom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const monkeys = { id: 2, name: 'Monkeys', icon: 'monkey' }
const bears = { id: 3, name: 'Bears', icon: 'bear' }
const day = (group: object) => ({ mine: true, expected: 2, here: 1, gone: 0, absent: 0, notYet: 1, alertsHere: 0, birthdays: [], ...group })

function teacherApi(own: object[], routes: Record<string, { status: number; body?: unknown }> = {}) {
  return fakeApi({
    'GET /api/health': health,
    'GET /api/session': sessionAs('teacher'),
    'GET /api/overview/mine': { status: 200, body: { day: '2027-01-04', groups: own } },
    ...routes,
  })
}

describe('a Teacher’s start page', () => {
  it('is their Group’s Today view when they work in one Group', async () => {
    teacherApi([day(monkeys)], { 'GET /api/groups/2': { status: 200, body: { ...monkeys, day: '2027-01-04', children: [] } } })
    renderAt('/', <App />)

    expect(await screen.findByRole('heading', { name: 'Monkeys', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Today, Monday, 4 January' })).toBeInTheDocument()
  })

  it('shows a tile for each of their Groups when they work in several', async () => {
    teacherApi([day(monkeys), day({ ...bears, here: 0, notYet: 2 })])
    renderAt('/', <App />)

    expect(await screen.findByRole('link', { name: /Monkeys/ })).toHaveAttribute('href', '/groups/2')
    expect(screen.getByRole('link', { name: /Bears/ })).toHaveTextContent('Here 0 · Gone home 0 · Absent 0 · Not here yet 2')
  })

  it('lists all Groups, and says how to get one, when they work in none', async () => {
    teacherApi([], { 'GET /api/groups': { status: 200, body: [{ ...bears, mine: false }, { ...monkeys, mine: false }] } })
    renderAt('/', <App />)

    expect(await screen.findByText('You don’t work in any Group yet. An Admin can add you to yours on the Staff accounts page.')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Bears/ })).toHaveAttribute('href', '/groups/3')
    expect(screen.getByRole('link', { name: /Monkeys/ })).toHaveAttribute('href', '/groups/2')
  })

  it('does not redirect away from other pages', async () => {
    teacherApi([day(monkeys)], { 'GET /api/children?search=': { status: 200, body: [] } })
    renderAt('/children', <App />)

    expect(await screen.findByRole('heading', { name: 'Children' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Monkeys' })).toBeNull()
  })
})
