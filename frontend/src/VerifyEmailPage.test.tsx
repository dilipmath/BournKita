// @vitest-environment happy-dom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeApi, renderAt } from './testing'
import VerifyEmailPage from './VerifyEmailPage'

async function choosePassword(password: string, repeated = password) {
  await userEvent.type(screen.getByLabelText('New password'), password)
  await userEvent.type(screen.getByLabelText('Repeat password'), repeated)
  await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
}

describe('verify email page', () => {
  it('saves the chosen password with the token from the link', async () => {
    const calls = fakeApi({ 'POST /api/email-verifications': { status: 204 } })
    renderAt('/verify-email?token=abc123', <VerifyEmailPage />)

    await choosePassword('correct horse battery')

    expect(await screen.findByRole('status')).toHaveTextContent('Your password is saved. You can now log in.')
    expect(screen.getByRole('link', { name: 'Go to login' })).toHaveAttribute('href', '/')
    expect(calls).toEqual([
      { route: 'POST /api/email-verifications', body: { token: 'abc123', password: 'correct horse battery' } },
    ])
  })

  it('catches mistyped passwords before asking the server', async () => {
    const calls = fakeApi({})
    renderAt('/verify-email?token=abc123', <VerifyEmailPage />)

    await choosePassword('correct horse battery', 'correct horse batery')

    expect(screen.getByRole('alert')).toHaveTextContent('The passwords do not match.')
    expect(calls).toEqual([])
  })

  it('explains an expired or used link', async () => {
    fakeApi({ 'POST /api/email-verifications': { status: 400, body: { detail: 'invalid_link' } } })
    renderAt('/verify-email?token=old', <VerifyEmailPage />)

    await choosePassword('correct horse battery')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This link is no longer valid. Please ask an Admin to send you a new one.',
    )
  })

  it('explains a password that is too short', async () => {
    fakeApi({ 'POST /api/email-verifications': { status: 422, body: { detail: 'password_too_short' } } })
    renderAt('/verify-email?token=abc123', <VerifyEmailPage />)

    await choosePassword('short')

    expect(await screen.findByRole('alert')).toHaveTextContent('The password needs at least 12 characters.')
  })
})
