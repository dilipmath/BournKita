// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import type { ConsentPeriod } from './api'
import { fakeApi, health, noProfileLists, renderAt, sessionAs } from './testing'

const lena = { id: 7, firstName: 'Lena', lastName: 'Müller', gender: null, languages: '', foodPreferences: '', interests: '' }
const given = { givenOn: '2026-09-01', withdrawnOn: null }
const withdrawn = { givenOn: '2026-03-01', withdrawnOn: '2026-06-15' }

function profile(consents: object) {
  return {
    status: 200,
    body: { ...lena, ...noProfileLists, consents: { photo: [], excursion: [], dataProtection: [], ...consents } },
  }
}

describe('Consents', () => {
  it('shows Teachers what each Consent is now, and since when', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/children/7': profile({ photo: [withdrawn, given], excursion: [withdrawn] }),
    })
    renderAt('/children/7', <App />)

    const section = await screen.findByRole('region', { name: 'Consents' })
    const items = within(section).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Photos: given since Sep 1, 2026'),
      expect.stringContaining('Excursions: withdrawn on Jun 15, 2026'),
      expect.stringContaining('Data protection: not given'),
    ])
    // Earlier periods stay visible.
    expect(items[0]).toHaveTextContent('Given Mar 1, 2026, withdrawn Jun 15, 2026')
    expect(within(section).queryByRole('button')).toBeNull()
  })

  it('lets an Admin record a withdrawal with its date', async () => {
    let photo: ConsentPeriod[] = [given]
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': () => profile({ photo }),
      'POST /api/children/7/consents/photo/withdrawn': (body) => {
        photo = [{ ...given, withdrawnOn: (body as { withdrawnOn: string }).withdrawnOn }]
        return { status: 204 }
      },
    })
    renderAt('/children/7', <App />)

    const section = await screen.findByRole('region', { name: 'Consents' })
    await userEvent.click(within(section).getByRole('button', { name: 'Record withdrawal of Photos' }))
    const form = within(section).getByRole('form', { name: 'Record withdrawal of Photos' })
    const date = within(form).getByLabelText('Withdrawn on')
    await userEvent.clear(date)
    await userEvent.type(date, '2026-10-20')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

    await within(section).findByRole('button', { name: 'Record giving of Photos' })
    expect(within(section).getAllByRole('listitem')[0]).toHaveTextContent('Photos: withdrawn on Oct 20, 2026')
    expect(calls).toContainEqual({ route: 'POST /api/children/7/consents/photo/withdrawn', body: { withdrawnOn: '2026-10-20' } })
  })

  it('tells an Admin why a date was refused', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': profile({ excursion: [withdrawn] }),
      'POST /api/children/7/consents/excursion/given': { status: 422, body: { detail: 'out_of_order' } },
    })
    renderAt('/children/7', <App />)

    const section = await screen.findByRole('region', { name: 'Consents' })
    await userEvent.click(within(section).getByRole('button', { name: 'Record giving of Excursions' }))
    const form = within(section).getByRole('form', { name: 'Record giving of Excursions' })
    const date = within(form).getByLabelText('Given on')
    await userEvent.clear(date)
    await userEvent.type(date, '2026-06-01')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await within(section).findByRole('alert')).toHaveTextContent(
      'The date must not be before the previous giving or withdrawal.',
    )
  })
})
