// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const changed = {
  id: 3,
  at: '2027-01-04T09:30:00Z',
  staffEmail: 'leitung@kita.example',
  action: 'changed',
  childId: 7,
  childName: 'Lena Müller',
  changedFields: ['foodPreferences', 'languages'],
}
const deleted = {
  id: 2,
  at: '2027-01-04T09:00:00Z',
  staffEmail: 'leitung@kita.example',
  action: 'deleted',
  childId: 5,
  childName: null,
  changedFields: [],
}

describe('audit log', () => {
  it('shows Admins who did what to which Child', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/audit-log?limit=50': { status: 200, body: [changed, deleted] },
    })
    renderAt('/', <App />)

    await userEvent.click(await screen.findByRole('link', { name: 'Audit log' }))

    const changeRow = await screen.findByRole('row', { name: /Changed/ })
    expect(changeRow).toHaveTextContent('leitung@kita.example')
    expect(within(changeRow).getByRole('link', { name: 'Lena Müller' })).toHaveAttribute('href', '/children/7')
    expect(changeRow).toHaveTextContent('Food preferences, Languages spoken')
    expect(screen.getByRole('row', { name: /Deleted/ })).toHaveTextContent('Deleted Child (no. 5)')
  })

  it('filters by Staff member, action and days', async () => {
    const since = new Date(2027, 0, 4).toISOString()
    const until = new Date(2027, 0, 6).toISOString()
    const filtered = `staffEmail=leitung%40kita.example&action=changed&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&limit=50`
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/audit-log?limit=50': { status: 200, body: [changed, deleted] },
      [`GET /api/audit-log?${filtered}`]: { status: 200, body: [changed] },
    })
    renderAt('/audit-log', <App />)
    await screen.findByRole('row', { name: /Deleted/ })

    await userEvent.type(screen.getByLabelText('Staff member'), 'leitung@kita.example')
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'changed')
    await userEvent.type(screen.getByLabelText('From'), '2027-01-04')
    await userEvent.type(screen.getByLabelText('To'), '2027-01-05')
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }))

    expect(await screen.findByRole('row', { name: /Changed/ })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /Deleted/ })).toBeNull()
  })

  it('opens from a Child profile with only that Child’s entries', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': {
        status: 200,
        body: { id: 7, firstName: 'Lena', lastName: 'Müller', gender: null, languages: '', foodPreferences: '', interests: '', parents: [], emergencyContacts: [], pickUpPersons: [] },
      },
      'GET /api/audit-log?childId=7&limit=50': { status: 200, body: [changed] },
    })
    renderAt('/children/7', <App />)

    await userEvent.click(await screen.findByRole('link', { name: 'Audit log for this Child' }))

    expect(await screen.findByText('Showing only entries about Lena Müller.')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Changed/ })).toBeInTheDocument()
  })

  it('loads older entries on request', async () => {
    const older = { ...deleted, id: 1, action: 'viewed', childId: 7, childName: 'Lena Müller' }
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/audit-log?limit=50': { status: 200, body: Array.from({ length: 50 }, (_, i) => ({ ...changed, id: 100 - i })) },
      'GET /api/audit-log?before=51&limit=50': { status: 200, body: [older] },
    })
    renderAt('/audit-log', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Show older entries' }))

    expect(await screen.findByRole('row', { name: /Viewed/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show older entries' })).toBeNull()
  })

  it('is not offered to Teachers, and refused at its address', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('teacher') })
    renderAt('/audit-log', <App />)

    expect(await screen.findByText('Only Admins can read the audit log.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Audit log' })).toBeNull()
  })
})
