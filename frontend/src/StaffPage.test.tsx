// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import StaffPage from './StaffPage'
import { fakeApi, renderAt } from './testing'

const leitung = { id: 1, email: 'leitung@kita.example', role: 'admin', status: 'active' }
const erzieherin = { id: 2, email: 'erzieherin@kita.example', role: 'teacher', status: 'invited' }

function row(email: string) {
  return screen.getByRole('row', { name: new RegExp(email) })
}

describe('staff accounts page', () => {
  it('lists every login with its role and status', async () => {
    fakeApi({ 'GET /api/staff': { status: 200, body: [leitung, erzieherin] } })

    renderAt('/staff', <StaffPage />)

    expect(await screen.findByRole('row', { name: /leitung@kita.example/ })).toHaveTextContent(/Active/)
    expect(within(row('leitung@kita.example')).getByRole('combobox', { name: 'Role' })).toHaveValue('admin')
    expect(row('erzieherin@kita.example')).toHaveTextContent(/Invited – email not verified yet/)
  })

  it('creates a Staff member, who appears as invited', async () => {
    const calls = fakeApi({
      'GET /api/staff': { status: 200, body: [leitung] },
      'POST /api/staff': { status: 201, body: erzieherin },
    })
    renderAt('/staff', <StaffPage />)
    await screen.findByRole('row', { name: /leitung@kita.example/ })

    await userEvent.type(screen.getByLabelText('Email address'), 'erzieherin@kita.example')
    await userEvent.selectOptions(screen.getByLabelText('Role of the new Staff member'), 'teacher')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('row', { name: /erzieherin@kita.example/ })).toHaveTextContent(/Invited/)
    expect(calls).toContainEqual({
      route: 'POST /api/staff',
      body: { email: 'erzieherin@kita.example', role: 'teacher' },
    })
    expect(screen.getByRole('status')).toHaveTextContent(
      'A verification email has been sent to erzieherin@kita.example.',
    )
  })

  it('says so when the email address already has an account', async () => {
    fakeApi({
      'GET /api/staff': { status: 200, body: [leitung] },
      'POST /api/staff': { status: 409, body: { detail: 'email_taken' } },
    })
    renderAt('/staff', <StaffPage />)
    await screen.findByRole('row', { name: /leitung@kita.example/ })

    await userEvent.type(screen.getByLabelText('Email address'), 'leitung@kita.example')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This email address already has an account.')
  })

  it('explains why the last active Admin cannot be demoted', async () => {
    fakeApi({
      'GET /api/staff': { status: 200, body: [leitung] },
      'PUT /api/staff/1/role': { status: 409, body: { detail: 'last_admin' } },
    })
    renderAt('/staff', <StaffPage />)
    await screen.findByRole('row', { name: /leitung@kita.example/ })

    await userEvent.selectOptions(within(row('leitung@kita.example')).getByRole('combobox', { name: 'Role' }), 'teacher')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The Kita needs at least one active Admin, so this change is not possible.',
    )
    expect(within(row('leitung@kita.example')).getByRole('combobox', { name: 'Role' })).toHaveValue('admin')
  })

  it('deactivates and reactivates an account', async () => {
    const teacher = { ...erzieherin, status: 'active' }
    fakeApi({
      'GET /api/staff': { status: 200, body: [leitung, teacher] },
      'PUT /api/staff/2/active': (body) => ({
        status: 200,
        body: { ...teacher, status: (body as { active: boolean }).active ? 'active' : 'deactivated' },
      }),
    })
    renderAt('/staff', <StaffPage />)
    await screen.findByRole('row', { name: /erzieherin@kita.example/ })

    await userEvent.click(within(row('erzieherin@kita.example')).getByRole('button', { name: 'Deactivate' }))
    expect(await screen.findByText('Deactivated')).toBeInTheDocument()

    await userEvent.click(within(row('erzieherin@kita.example')).getByRole('button', { name: 'Reactivate' }))
    expect(await within(row('erzieherin@kita.example')).findByText('Active')).toBeInTheDocument()
  })

  it('sends an invited Staff member a new link', async () => {
    const calls = fakeApi({
      'GET /api/staff': { status: 200, body: [leitung, erzieherin] },
      'POST /api/staff/2/invitation': { status: 204 },
    })
    renderAt('/staff', <StaffPage />)
    await screen.findByRole('row', { name: /erzieherin@kita.example/ })

    await userEvent.click(within(row('erzieherin@kita.example')).getByRole('button', { name: 'Send new link' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'A verification email has been sent to erzieherin@kita.example.',
    )
    expect(calls.map((call) => call.route)).toContain('POST /api/staff/2/invitation')
    expect(within(row('leitung@kita.example')).queryByRole('button', { name: 'Send new link' })).toBeNull()
  })

  it('explains that Admins cannot deactivate their own account', async () => {
    fakeApi({
      'GET /api/staff': { status: 200, body: [leitung] },
      'PUT /api/staff/1/active': { status: 409, body: { detail: 'own_account' } },
    })
    renderAt('/staff', <StaffPage />)
    await screen.findByRole('row', { name: /leitung@kita.example/ })

    await userEvent.click(within(row('leitung@kita.example')).getByRole('button', { name: 'Deactivate' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You cannot deactivate your own account. Another Admin has to do it.',
    )
  })

  it('shows the Admins-only notice once an Admin is no longer allowed, e.g. after demoting themselves', async () => {
    fakeApi({
      'GET /api/staff': { status: 200, body: [leitung, erzieherin] },
      'PUT /api/staff/2/active': { status: 403, body: { detail: 'admins_only' } },
    })
    renderAt('/staff', <StaffPage />)
    await screen.findByRole('row', { name: /erzieherin@kita.example/ })

    await userEvent.click(within(row('erzieherin@kita.example')).getByRole('button', { name: 'Deactivate' }))

    expect(await screen.findByText('Only Admins can manage staff accounts.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('tells a Teacher the page is for Admins only', async () => {
    fakeApi({ 'GET /api/staff': { status: 403, body: { detail: 'admins_only' } } })

    renderAt('/staff', <StaffPage />)

    expect(await screen.findByText('Only Admins can manage staff accounts.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
