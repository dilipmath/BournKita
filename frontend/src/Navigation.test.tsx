// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const monkeys = { id: 2, name: 'Monkeys', icon: 'monkey' }

/** The labels of a navigation's links, without their icons. */
function links(name: string) {
  return within(screen.getByRole('navigation', { name }))
    .getAllByRole('link')
    .map((link) => link.textContent?.replace(/^\W+/u, ''))
}

describe('navigation', () => {
  it('offers Teachers the daily pages only', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('teacher'), 'GET /api/groups': { status: 200, body: [] } })
    renderAt('/', <App />)

    await screen.findByRole('navigation', { name: 'Main navigation' })

    expect(links('Main navigation')).toEqual(['Home', 'Children', 'Calendar', 'Incidents'])
  })

  it('offers Admins the Administration page, which lists the Admin pages', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('admin'), 'GET /api/groups': { status: 200, body: [] } })
    renderAt('/', <App />)

    await screen.findByRole('navigation', { name: 'Main navigation' })
    expect(links('Main navigation')).toEqual(['Home', 'Children', 'Calendar', 'Incidents', 'Administration'])
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /Administration/ }))

    const page = await screen.findByRole('region', { name: 'Administration' })
    expect(within(page).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/groups',
      '/staff',
      '/holidays',
      '/audit-log',
      '/archive',
    ])
  })

  it('shows Teachers who open the Administration address the Admins-only notice', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('teacher') })
    renderAt('/administration', <App />)

    expect(await screen.findByText('Only Admins can open this page.')).toBeInTheDocument()
  })

  it('shows a Group’s Today, Tasks and Calendar inside the Group, the open one marked', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/groups/2': { status: 200, body: { ...monkeys, day: '2027-01-04', children: [] } },
    })
    renderAt('/groups/2', <App />)

    const group = await screen.findByRole('navigation', { name: 'The Group’s pages' })
    expect(within(group).getAllByRole('link').map((link) => [link.textContent?.replace(/^\W+/u, ''), link.getAttribute('href')])).toEqual([
      ['Today', '/groups/2'],
      ['Tasks', '/groups/2/board'],
      ['Calendar', '/groups/2/calendar'],
    ])
    expect(within(group).getByRole('link', { name: /Today/ })).toHaveAttribute('aria-current', 'page')
  })

  it('shows no Group pages outside a Group', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('teacher'), 'GET /api/children?search=': { status: 200, body: [] } })
    renderAt('/children', <App />)

    await screen.findByRole('navigation', { name: 'Main navigation' })
    expect(screen.queryByRole('navigation', { name: 'The Group’s pages' })).toBeNull()
  })
})

describe('the current page in the navigation', () => {
  it('is Administration while an Admin page is open', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('admin'), 'GET /api/groups': { status: 200, body: [] } })
    renderAt('/groups', <App />)

    const main = await screen.findByRole('navigation', { name: 'Main navigation' })
    expect(within(main).getByRole('link', { name: 'Administration' })).toHaveAttribute('aria-current', 'page')
    expect(within(main).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('is Tasks while the Group’s backlog is open', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/groups/2': { status: 200, body: { ...monkeys, day: '2027-01-04', children: [] } },
      'GET /api/groups/2/tasks': { status: 200, body: [] },
      'GET /api/groups/2/assignees': { status: 200, body: [] },
    })
    renderAt('/groups/2/backlog', <App />)

    const group = await screen.findByRole('navigation', { name: 'The Group’s pages' })
    expect(within(group).getByRole('link', { name: 'Tasks' })).toHaveAttribute('aria-current', 'page')
  })
})
