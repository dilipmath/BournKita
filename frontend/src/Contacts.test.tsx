// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, noProfileLists, renderAt, sessionAs } from './testing'

const lena = { id: 7, firstName: 'Lena', lastName: 'Müller', gender: null, languages: '', foodPreferences: '', interests: '' }
const anna = { id: 3, firstName: 'Anna', lastName: 'Müller', address: '', phone: '+49 30 1234567', email: '', mayPickUp: true }
const oma = { id: 11, name: 'Erika Müller', relationship: 'Grandmother', phone: '+49 30 7654321', note: '' }
const tom = { id: 12, name: 'Tom Weber', relationship: 'Neighbour', phone: '0171 2223334', note: 'Shows his ID card' }

type Profile = { parents: unknown[]; emergencyContacts: unknown[]; pickUpPersons: unknown[] }

function profile(parts: Partial<Profile> = {}) {
  return { status: 200, body: { ...lena, ...noProfileLists, ...parts } }
}

describe('Emergency contacts and Pick-up persons', () => {
  it('shows Teachers who may pick the Child up and whom to call in an emergency', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/children/7': profile({
        parents: [anna, { ...anna, id: 4, firstName: 'Jan', mayPickUp: false }],
        emergencyContacts: [oma],
        pickUpPersons: [tom],
      }),
    })
    renderAt('/children/7', <App />)

    const pickUp = await screen.findByRole('region', { name: 'Who may pick up' })
    expect(within(pickUp).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Anna Müller'),
      expect.stringContaining('Tom Weber'),
    ])
    expect(pickUp).toHaveTextContent('Shows his ID card')
    expect(pickUp).not.toHaveTextContent('Jan Müller')
    const emergency = screen.getByRole('region', { name: 'Emergency contacts' })
    expect(within(emergency).getByRole('link', { name: '+49 30 7654321' })).toHaveAttribute('href', 'tel:+49307654321')
    expect(emergency).toHaveTextContent('Grandmother')
    expect(within(emergency).queryByRole('button')).toBeNull()
  })

  it('lets an Admin add an Emergency contact', async () => {
    let added = false
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': () => profile(added ? { emergencyContacts: [oma] } : {}),
      'POST /api/children/7/contacts': () => {
        added = true
        return { status: 201, body: oma }
      },
    })
    renderAt('/children/7', <App />)

    const emergency = await screen.findByRole('region', { name: 'Emergency contacts' })
    await userEvent.click(within(emergency).getByRole('button', { name: 'Add emergency contact' }))
    const form = within(emergency).getByRole('form', { name: 'Add emergency contact' })
    await userEvent.type(within(form).getByLabelText('Name'), 'Erika Müller')
    await userEvent.type(within(form).getByLabelText('Relationship'), 'Grandmother')
    await userEvent.type(within(form).getByLabelText('Phone'), '+49 30 7654321')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await within(emergency).findByText('Erika Müller')).toBeInTheDocument()
    expect(calls).toContainEqual({
      route: 'POST /api/children/7/contacts',
      body: { kind: 'emergency', name: 'Erika Müller', relationship: 'Grandmother', phone: '+49 30 7654321', note: '' },
    })
  })

  it('lets an Admin change and remove a Pick-up person', async () => {
    let stored: typeof tom | null = tom
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': () => profile({ pickUpPersons: stored ? [stored] : [] }),
      'PUT /api/children/7/contacts/12': (body) => {
        stored = { ...(body as typeof tom), id: 12 }
        return { status: 200, body: stored }
      },
      'DELETE /api/children/7/contacts/12': () => {
        stored = null
        return { status: 204 }
      },
    })
    renderAt('/children/7', <App />)

    const pickUp = await screen.findByRole('region', { name: 'Who may pick up' })
    await userEvent.click(within(pickUp).getByRole('button', { name: 'Change Tom Weber' }))
    const form = within(pickUp).getByRole('form', { name: 'Change Tom Weber' })
    await userEvent.clear(within(form).getByLabelText('Note'))
    await userEvent.type(within(form).getByLabelText('Note'), 'Bring the pick-up card')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))
    expect(await within(pickUp).findByText('Bring the pick-up card')).toBeInTheDocument()

    await userEvent.click(within(pickUp).getByRole('button', { name: 'Remove Tom Weber' }))
    expect(await within(pickUp).findByText('Nobody may pick up yet.')).toBeInTheDocument()
    expect(calls.map((call) => call.route)).toContain('DELETE /api/children/7/contacts/12')
  })

  it('lets an Admin say a Parent may not pick up', async () => {
    let mayPickUp = true
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': () => profile({ parents: [{ ...anna, mayPickUp }] }),
      'PUT /api/children/7/parents/3': (body) => {
        mayPickUp = (body as { mayPickUp: boolean }).mayPickUp
        return { status: 204 }
      },
    })
    renderAt('/children/7', <App />)

    const parents = await screen.findByRole('region', { name: 'Parents' })
    await userEvent.click(within(parents).getByRole('checkbox', { name: 'Anna Müller may pick up' }))

    const pickUp = screen.getByRole('region', { name: 'Who may pick up' })
    expect(await within(pickUp).findByText('Nobody may pick up yet.')).toBeInTheDocument()
    expect(calls).toContainEqual({ route: 'PUT /api/children/7/parents/3', body: { mayPickUp: false } })
  })
})
