// @vitest-environment happy-dom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

describe('app navigation', () => {
  it('offers Admins the staff accounts page', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/staff': { status: 200, body: [] },
    })
    renderAt('/', <App />)

    await userEvent.click(await screen.findByRole('link', { name: 'Administration' }))
    await userEvent.click(await screen.findByRole('link', { name: 'Staff accounts' }))

    expect(await screen.findByRole('heading', { name: 'Staff accounts' })).toBeInTheDocument()
  })

  it('does not offer Teachers the staff accounts page', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('teacher') })
    renderAt('/', <App />)

    expect(await screen.findByRole('button', { name: 'Menu for teacher@kita.example' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Staff accounts' })).toBeNull()
  })

  it('shows Teachers who open the staff accounts address the Admins-only notice', async () => {
    const calls = fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('teacher') })
    renderAt('/staff', <App />)

    expect(await screen.findByText('Only Admins can manage staff accounts.')).toBeInTheDocument()
    expect(calls.map((call) => call.route)).not.toContain('GET /api/staff')
  })

  it('asks for a login before showing the staff accounts page', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': { status: 401, body: { detail: 'not_logged_in' } } })
    renderAt('/staff', <App />)

    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Staff accounts' })).toBeNull()
  })

  it('opens the page for choosing a password from the email link without a login', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': { status: 401, body: { detail: 'not_logged_in' } } })
    renderAt('/verify-email?token=abc123', <App />)

    expect(await screen.findByRole('heading', { name: 'Choose your password' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log in' })).toBeNull()
  })
})

describe('greeting', () => {
  it('greets the Staff member by their display name', async () => {
    const session = sessionAs('teacher')
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': { ...session, body: { ...session.body, displayName: 'Aylin' } },
      'GET /api/groups': { status: 200, body: [] },
    })
    renderAt('/', <App />)

    expect(await screen.findByRole('button', { name: 'Menu for Aylin' })).toHaveTextContent('Aylin')
    await userEvent.click(screen.getByRole('button', { name: 'Menu for Aylin' }))
    expect(screen.getByText('Logged in as Aylin')).toBeInTheDocument()
  })
})

describe('header', () => {
  it('keeps the language and Log out in the account menu', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/groups': { status: 200, body: [] },
      'DELETE /api/session': { status: 204 },
    })
    renderAt('/', <App />)

    const menu = await screen.findByRole('button', { name: 'Menu for teacher@kita.example' })
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull()
    await userEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Deutsch' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument()
  })

  it('offers the Group’s and the whole Kita’s emergency list inside a Group', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/groups/2': { status: 200, body: { id: 2, name: 'Monkeys', icon: 'monkey', day: '2027-01-04', children: [] } },
    })
    renderAt('/groups/2', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Emergency' }))

    expect(screen.getByRole('link', { name: 'Emergency list (PDF)' })).toHaveAttribute('href', '/api/emergency-list?groupId=2&language=en')
    expect(screen.getByRole('link', { name: 'Emergency list of the whole Kita (PDF)' })).toHaveAttribute('href', '/api/emergency-list?language=en')
  })

  it('offers only the whole Kita’s emergency list outside a Group', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('admin'), 'GET /api/groups': { status: 200, body: [] } })
    renderAt('/groups', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Emergency' }))

    expect(screen.getByRole('link', { name: 'Emergency list of the whole Kita (PDF)' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Emergency list (PDF)' })).toBeNull()
  })

  it('says nothing about the server while it works', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('teacher'), 'GET /api/groups': { status: 200, body: [] } })
    renderAt('/', <App />)
    await screen.findByRole('button', { name: 'Menu for teacher@kita.example' })
    expect(screen.queryByRole('heading', { name: 'System status' })).toBeNull()
    expect(screen.queryByText('All systems working')).toBeNull()
  })

  it('warns when the server cannot be reached', async () => {
    fakeApi({ 'GET /api/health': { status: 503 }, 'GET /api/session': sessionAs('teacher'), 'GET /api/children?search=': { status: 200, body: [] } })
    renderAt('/children', <App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('not reachable')
  })
})

describe('account menu', () => {
  it('switches the language', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('teacher'), 'GET /api/groups': { status: 200, body: [] } })
    renderAt('/', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Menu for teacher@kita.example' }))
    await userEvent.click(screen.getByRole('button', { name: 'Deutsch' }))

    expect(await screen.findByRole('button', { name: 'Menü für teacher@kita.example' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'English' }))
  })

  it('logs out even when the server cannot be reached', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/groups': { status: 200, body: [] },
      'DELETE /api/session': { status: 503 },
    })
    renderAt('/', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Menu for teacher@kita.example' }))
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument()
  })

  it('closes on Escape and gives the keyboard back to its button', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('teacher'), 'GET /api/groups': { status: 200, body: [] } })
    renderAt('/', <App />)

    const menu = await screen.findByRole('button', { name: 'Menu for teacher@kita.example' })
    await userEvent.click(menu)
    await userEvent.tab()
    await userEvent.keyboard('{Escape}')

    expect(menu).toHaveAttribute('aria-expanded', 'false')
    expect(menu).toHaveFocus()
  })
})

describe('status banner', () => {
  it('warns when the database cannot be reached', async () => {
    fakeApi({
      'GET /api/health': { status: 503, body: { status: 'degraded', database: 'unavailable', time: '2027-01-04T08:00:00Z' } },
      'GET /api/session': sessionAs('teacher'),
      'GET /api/groups': { status: 200, body: [] },
    })
    renderAt('/', <App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Database not reachable')
  })
})
