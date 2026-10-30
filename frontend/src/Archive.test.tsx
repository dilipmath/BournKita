// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const lena = { id: 7, firstName: 'Lena', lastName: 'Müller', archivedAt: '2027-01-04T08:00:00Z', purgeOn: '2028-01-04' }

describe('Archive', () => {
  it('lets an Admin restore a deleted Child profile', async () => {
    let archived = [lena]
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/archive': () => ({ status: 200, body: archived }),
      'POST /api/archive/7/restore': () => {
        archived = []
        return { status: 204 }
      },
    })
    renderAt('/', <App />)

    await userEvent.click(await screen.findByRole('link', { name: 'Archive' }))
    const entry = await screen.findByRole('listitem')
    expect(entry).toHaveTextContent('Lena Müller')
    // At the Kita's time; how Intl joins day and time varies between ICU versions.
    expect(entry).toHaveTextContent(/Deleted 4 January 2027(,| at) 09:00\. Purged on 4 January 2028\./)
    await userEvent.click(within(entry).getByRole('button', { name: 'Restore Lena Müller' }))

    expect(await screen.findByRole('status')).toHaveTextContent('The profile of Lena Müller is back.')
    expect(screen.getByRole('link', { name: 'Lena Müller' })).toHaveAttribute('href', '/children/7')
    expect(await screen.findByText('The archive is empty.')).toBeInTheDocument()
    expect(calls).toContainEqual({ route: 'POST /api/archive/7/restore', body: undefined })
  })

  it('is for Admins only', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('teacher') })
    renderAt('/archive', <App />)

    expect(await screen.findByText('Only Admins can open the archive.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Archive' })).not.toBeInTheDocument()
  })
})
