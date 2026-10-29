// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const publicHolidays = { kind: 'public', count: 12, firstDay: '2027-01-01', lastDay: '2027-12-26' }
const ics = () => new File(['BEGIN:VCALENDAR'], 'ferien-berlin.ics', { type: 'text/calendar' })

describe('Holidays', () => {
  it('lets an Admin import school holidays from an iCal file', async () => {
    let imported = [publicHolidays]
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/holidays': () => ({ status: 200, body: imported }),
      'PUT /api/holidays/school': () => {
        imported = [publicHolidays, { kind: 'school', count: 6, firstDay: '2027-02-01', lastDay: '2027-12-31' }]
        return { status: 200, body: { imported: 6 } }
      },
    })
    renderAt('/holidays', <App />)

    const publicSection = await screen.findByRole('region', { name: 'Public holidays' })
    expect(await within(publicSection).findByText('12 imported, from 1 January 2027 to 26 December 2027.')).toBeInTheDocument()
    const school = screen.getByRole('region', { name: 'School holidays' })
    expect(school).toHaveTextContent('None imported yet.')
    await userEvent.upload(within(school).getByLabelText('iCal file (.ics)'), ics())
    await userEvent.click(within(school).getByRole('button', { name: 'Import school holidays' }))

    expect(await within(school).findByRole('status')).toHaveTextContent('6 holidays imported. They replace the ones before.')
    expect(school).toHaveTextContent('6 imported, from 1 February 2027 to 31 December 2027.')
    expect(calls).toContainEqual({ route: 'PUT /api/holidays/school', body: { file: 'ferien-berlin.ics' } })
  })

  it('says why a file could not be imported', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/holidays': { status: 200, body: [] },
      'PUT /api/holidays/public': { status: 422, body: { detail: 'repeating_holidays' } },
    })
    renderAt('/holidays', <App />)

    const publicSection = await screen.findByRole('region', { name: 'Public holidays' })
    await userEvent.upload(within(publicSection).getByLabelText('iCal file (.ics)'), ics())
    await userEvent.click(within(publicSection).getByRole('button', { name: 'Import public holidays' }))

    expect(await within(publicSection).findByRole('alert')).toHaveTextContent('This file has repeating entries')
  })

  it('is for Admins only', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/groups': { status: 200, body: [] },
    })
    renderAt('/holidays', <App />)

    expect(await screen.findByText('Only Admins can import holidays.')).toBeInTheDocument()
  })
})
