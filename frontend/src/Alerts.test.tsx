// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, noProfileLists, renderAt, sessionAs } from './testing'

const lena = { id: 7, firstName: 'Lena', lastName: 'Müller', gender: null, languages: '', foodPreferences: 'Vegetarian', interests: '' }
const peanuts = { id: 21, kind: 'allergy', name: 'Peanuts', note: 'EpiPen in the red bag' }
const asthma = { id: 22, kind: 'medical', name: 'Asthma', note: '' }

function profile(alerts: unknown[]) {
  return { status: 200, body: { ...lena, ...noProfileLists, alerts } }
}

describe('Allergy and medical alerts', () => {
  it('shows Teachers a banner on the profile and allergies next to food preferences', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/children/7': profile([peanuts, asthma]),
    })
    renderAt('/children/7', <App />)

    const banner = await screen.findByRole('region', { name: 'Allergies and medical conditions' })
    expect(within(banner).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringMatching(/Allergy.*Peanuts.*EpiPen in the red bag/),
      expect.stringMatching(/Medical condition.*Asthma/),
    ])
    expect(within(banner).queryByRole('button')).toBeNull()
    // Medical conditions are in the banner; next to the food, only what the Child must not eat.
    const food = screen.getByText('Vegetarian').closest('dd')
    expect(food).toHaveTextContent('Allergies: Peanuts')
    expect(food).not.toHaveTextContent('Asthma')
  })

  it('says when no alerts are recorded', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/children/7': profile([]),
    })
    renderAt('/children/7', <App />)

    const banner = await screen.findByRole('region', { name: 'Allergies and medical conditions' })
    expect(banner).toHaveTextContent('No allergies or medical conditions recorded.')
    expect(screen.getByText('Vegetarian').closest('dd')).not.toHaveTextContent('Allergies')
  })

  it('lets an Admin add an allergy', async () => {
    let alerts: unknown[] = []
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': () => profile(alerts),
      'POST /api/children/7/alerts': () => {
        alerts = [peanuts]
        return { status: 201, body: peanuts }
      },
    })
    renderAt('/children/7', <App />)

    const banner = await screen.findByRole('region', { name: 'Allergies and medical conditions' })
    await userEvent.click(within(banner).getByRole('button', { name: 'Add allergy or medical condition' }))
    const form = within(banner).getByRole('form', { name: 'Add allergy or medical condition' })
    await userEvent.type(within(form).getByLabelText('Allergic to, or condition'), 'Peanuts')
    await userEvent.type(within(form).getByLabelText('What to do'), 'EpiPen in the red bag')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await within(banner).findByText('Peanuts')).toBeInTheDocument()
    expect(calls).toContainEqual({
      route: 'POST /api/children/7/alerts',
      body: { kind: 'allergy', name: 'Peanuts', note: 'EpiPen in the red bag' },
    })
  })

  it('lets an Admin change and remove an alert', async () => {
    let stored: Record<string, unknown> | null = peanuts
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': () => profile(stored ? [stored] : []),
      'PUT /api/children/7/alerts/21': (body) => {
        stored = { ...(body as object), id: 21 }
        return { status: 200, body: stored }
      },
      'DELETE /api/children/7/alerts/21': () => {
        stored = null
        return { status: 204 }
      },
    })
    renderAt('/children/7', <App />)

    const banner = await screen.findByRole('region', { name: 'Allergies and medical conditions' })
    await userEvent.click(within(banner).getByRole('button', { name: 'Change Peanuts' }))
    const form = within(banner).getByRole('form', { name: 'Change Peanuts' })
    await userEvent.selectOptions(within(form).getByLabelText('Kind'), 'Medical condition')
    await userEvent.clear(within(form).getByLabelText('Allergic to, or condition'))
    await userEvent.type(within(form).getByLabelText('Allergic to, or condition'), 'Epilepsy')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))
    expect(await within(banner).findByText('Epilepsy')).toBeInTheDocument()
    expect(calls).toContainEqual({
      route: 'PUT /api/children/7/alerts/21',
      body: { kind: 'medical', name: 'Epilepsy', note: 'EpiPen in the red bag' },
    })

    await userEvent.click(within(banner).getByRole('button', { name: 'Remove Epilepsy' }))
    expect(await within(banner).findByText('No allergies or medical conditions recorded.')).toBeInTheDocument()
  })

  it('marks Children with alerts on the Group dashboard', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/groups': { status: 200, body: [{ id: 2, name: 'Monkeys', icon: 'monkey', mine: true }] },
      'GET /api/groups/2': {
        status: 200,
        body: {
          id: 2,
          name: 'Monkeys',
          icon: 'monkey',
          day: '2027-01-04',
          children: [
            { id: 7, firstName: 'Lena', lastName: 'Müller', alerts: [peanuts, asthma] },
            { id: 8, firstName: 'Mia', lastName: 'Müller', alerts: [] },
          ],
        },
      },
    })
    renderAt('/groups/2', <App />)

    const [lenaItem, miaItem] = await screen.findAllByRole('listitem')
    expect(within(lenaItem).getByRole('link', { name: 'Lena Müller' })).toBeInTheDocument()
    expect(lenaItem).toHaveTextContent('Alerts: Peanuts, Asthma')
    expect(miaItem).not.toHaveTextContent('Alerts')
  })
})
