// @vitest-environment happy-dom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, renderAt } from './testing'

const loggedOut = {
  'GET /api/health': { status: 200, body: { status: 'ok', database: 'ok', time: '2027-01-04T08:00:00Z' } },
  'GET /api/session': { status: 401, body: { detail: 'not_logged_in' } },
}

async function choosePassword(password: string) {
  await userEvent.type(screen.getByLabelText('New password'), password)
  await userEvent.type(screen.getByLabelText('Repeat password'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
}

describe('forgotten password', () => {
  it('asks for a reset link from the login form', async () => {
    const calls = fakeApi({ ...loggedOut, 'POST /api/password-resets': { status: 202 } })
    renderAt('/', <App />)

    await userEvent.click(await screen.findByRole('link', { name: 'Forgot your password?' }))
    await userEvent.type(screen.getByLabelText('Email address'), 'erzieherin@kita.example')
    await userEvent.click(screen.getByRole('button', { name: 'Send link' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'If erzieherin@kita.example has an account, a link for choosing a new password is on its way. It is valid for 1 hour.',
    )
    expect(calls.filter((call) => call.route === 'POST /api/password-resets')).toEqual([
      { route: 'POST /api/password-resets', body: { email: 'erzieherin@kita.example' } },
    ])
  })

  it('saves the new password with the token from the link, without a login', async () => {
    const calls = fakeApi({ ...loggedOut, 'PUT /api/password-resets': { status: 204 } })
    renderAt('/reset-password?token=abc123', <App />)

    await choosePassword('a brand new password')

    expect(await screen.findByText('Your password is saved. You can now log in.')).toBeInTheDocument()
    expect(calls.filter((call) => call.route === 'PUT /api/password-resets')).toEqual([
      { route: 'PUT /api/password-resets', body: { token: 'abc123', password: 'a brand new password' } },
    ])
  })

  it('offers a new link when the reset link is no longer valid', async () => {
    fakeApi({ ...loggedOut, 'PUT /api/password-resets': { status: 400, body: { detail: 'invalid_link' } } })
    renderAt('/reset-password?token=old', <App />)

    await choosePassword('a brand new password')

    expect(await screen.findByRole('alert')).toHaveTextContent('This link is no longer valid.')
    await userEvent.click(screen.getByRole('link', { name: 'Ask for a new link' }))
    expect(screen.getByRole('button', { name: 'Send link' })).toBeInTheDocument()
  })

  it('explains the lockout on a refused login and points to the password reset', async () => {
    fakeApi({ ...loggedOut, 'POST /api/session': { status: 401, body: { detail: 'invalid_credentials' } } })
    renderAt('/', <App />)

    await userEvent.type(await screen.findByLabelText('Email address'), 'leitung@kita.example')
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse battery')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email address or password is wrong.')
    expect(
      screen.getByText(
        'After 5 failed logins in a row, the account is locked for 15 minutes. Choosing a new password unlocks it.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toBeInTheDocument()
  })
})
