// @vitest-environment happy-dom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, renderAt } from './testing'

const health = { status: 200, body: { status: 'ok', database: 'ok', time: '2027-01-04T08:00:00Z' } }

function sessionAs(role: 'admin' | 'teacher') {
  return { status: 200, body: { email: `${role}@kita.example`, role, inactivityTimeoutMinutes: 30 } }
}

describe('app navigation', () => {
  it('offers Admins the staff accounts page', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/staff': { status: 200, body: [] },
    })
    renderAt('/', <App />)

    await userEvent.click(await screen.findByRole('link', { name: 'Staff accounts' }))

    expect(await screen.findByRole('heading', { name: 'Staff accounts' })).toBeInTheDocument()
  })

  it('does not offer Teachers the staff accounts page', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('teacher') })
    renderAt('/', <App />)

    expect(await screen.findByText('Logged in as teacher@kita.example')).toBeInTheDocument()
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
