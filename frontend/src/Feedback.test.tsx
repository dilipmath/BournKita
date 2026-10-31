// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

describe('Feedback', () => {
  it('sends a problem, change request or idea with the page it came from', async () => {
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/children': { status: 200, body: [] },
      'POST /api/feedback': { status: 201, body: { emailed: true } },
    })
    renderAt('/children', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Feedback' }))
    const form = screen.getByRole('form', { name: 'Feedback' })
    expect(form).toHaveTextContent('Please do not write names of Children or health details.')
    await userEvent.click(within(form).getByRole('radio', { name: 'Change request' }))
    await userEvent.type(within(form).getByLabelText('What would you like to tell us?'), 'Sort by last name, please.')
    await userEvent.click(within(form).getByRole('button', { name: 'Send feedback' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Thank you! Your feedback was sent.')
    expect(calls).toContainEqual({
      route: 'POST /api/feedback',
      body: { kind: 'changeRequest', text: 'Sort by last name, please.', page: '/children' },
    })
  })

  it('is not offered before logging in', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': { status: 401, body: { detail: 'not_logged_in' } } })
    renderAt('/', <App />)

    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Feedback' })).not.toBeInTheDocument()
  })
})
