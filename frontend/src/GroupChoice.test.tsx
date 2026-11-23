// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const monkeys = { id: 2, name: 'Monkeys', icon: 'monkey', mine: true }
const butterflies = { id: 3, name: 'Butterflies', icon: 'butterfly', mine: false }

function appAs(role: 'admin' | 'teacher' | 'guest', groups: unknown[]) {
  return fakeApi({
    'GET /api/health': health,
    'GET /api/session': sessionAs(role),
    'GET /api/groups': { status: 200, body: groups },
    'GET /api/children': { status: 200, body: [] },
  })
}

function topBarChoice() {
  return screen.findByRole('combobox', { name: 'Current Group' })
}

function options(choice: HTMLElement) {
  return within(choice)
    .getAllByRole('option')
    .map((option) => option.textContent?.trim())
}

describe('the Group drop-down in the top bar', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('starts on the only Group a Teacher works in', async () => {
    appAs('teacher', [monkeys, butterflies])
    renderAt('/administration', <App />)

    const choice = await topBarChoice()
    expect(options(choice)).toEqual(['🐒 Monkeys'])
    expect(choice).toHaveDisplayValue('🐒 Monkeys')
  })

  it('offers Admins every Group and All Groups, and opens the chosen Group', async () => {
    appAs('admin', [monkeys, butterflies])
    renderAt('/administration', <App />)

    const choice = await topBarChoice()
    expect(options(choice)).toEqual(['All Groups', '🐒 Monkeys', '🦋 Butterflies'])
    expect(choice).toHaveDisplayValue('All Groups')

    await userEvent.selectOptions(choice, '🦋 Butterflies')

    expect(await screen.findByRole('navigation', { name: 'The Group’s pages' })).toBeInTheDocument()
    expect(await topBarChoice()).toHaveDisplayValue('🦋 Butterflies')
  })

  it('offers All Groups on the Children list even to a Teacher in one Group, since they see every Child', async () => {
    appAs('teacher', [monkeys, butterflies])
    renderAt('/children', <App />)

    const choice = await topBarChoice()
    expect(options(choice)).toEqual(['All Groups', '🐒 Monkeys'])
    expect(choice).toHaveDisplayValue('All Groups')
  })

  it('offers All Groups to a Teacher in several Groups', async () => {
    appAs('teacher', [monkeys, { ...butterflies, mine: true }])
    renderAt('/children', <App />)

    expect(options(await topBarChoice())).toEqual(['All Groups', '🐒 Monkeys', '🦋 Butterflies'])
  })

  it('shows the Group whose pages are open', async () => {
    appAs('admin', [monkeys, butterflies])
    renderAt('/groups/3/board', <App />)

    expect(await topBarChoice()).toHaveDisplayValue('🦋 Butterflies')
  })

  it('keeps the chosen Group while other pages are open', async () => {
    appAs('admin', [monkeys, butterflies])
    renderAt('/children', <App />)

    await userEvent.selectOptions(await topBarChoice(), '🐒 Monkeys')
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /Children/ }))

    expect(await topBarChoice()).toHaveDisplayValue('🐒 Monkeys')
  })

  it('is not there for Guests', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('guest'),
      'GET /api/groups': { status: 200, body: [monkeys] },
      'GET /api/calendar?from=2026-11-01&to=2026-12-01': { status: 200, body: { events: [], holidays: [], birthdays: [] } },
    })
    renderAt('/calendar', <App />)

    await screen.findByRole('navigation', { name: 'Main navigation' })
    expect(screen.queryByRole('combobox', { name: 'Current Group' })).toBeNull()
  })
})
