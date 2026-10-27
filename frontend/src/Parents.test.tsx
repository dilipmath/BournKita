// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const anna = {
  id: 3,
  firstName: 'Anna',
  lastName: 'Müller',
  address: 'Lindenstraße 12, 10115 Berlin',
  phone: '+49 30 1234567',
  email: 'anna.mueller@example.org',
}
const lena = {
  id: 7,
  firstName: 'Lena',
  lastName: 'Müller',
  gender: null,
  languages: '',
  foodPreferences: '',
  interests: '',
}

function profile(parents: unknown[]) {
  return { status: 200, body: { ...lena, parents } }
}

describe('Parents', () => {
  it('shows a Child’s Parents with their contact details, read-only for Teachers', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('teacher'), 'GET /api/children/7': profile([anna]) })
    renderAt('/children/7', <App />)

    const parents = await screen.findByRole('region', { name: 'Parents' })
    expect(within(parents).getByRole('link', { name: 'Anna Müller' })).toHaveAttribute('href', '/parents/3')
    expect(parents).toHaveTextContent('Lindenstraße 12, 10115 Berlin')
    expect(within(parents).getByRole('link', { name: '+49 30 1234567' })).toHaveAttribute('href', 'tel:+49301234567')
    expect(within(parents).getByRole('link', { name: 'anna.mueller@example.org' })).toHaveAttribute(
      'href',
      'mailto:anna.mueller@example.org',
    )
    expect(within(parents).queryByRole('button')).toBeNull()
    expect(within(parents).queryByRole('link', { name: 'Add Parent' })).toBeNull()
  })

  it('lets an Admin link a Parent who is already recorded, e.g. for a Sibling', async () => {
    let linked = false
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': () => profile(linked ? [anna] : []),
      'GET /api/parents?search=': { status: 200, body: [] },
      'GET /api/parents?search=m%C3%BCller': { status: 200, body: [{ id: 3, firstName: 'Anna', lastName: 'Müller' }] },
      'PUT /api/children/7/parents/3': () => {
        linked = true
        return { status: 204 }
      },
    })
    renderAt('/children/7', <App />)

    await userEvent.click(await screen.findByRole('link', { name: 'Add Parent' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a recorded Parent' }), 'müller')
    await userEvent.click(await screen.findByRole('button', { name: 'Link Anna Müller' }))

    expect(await screen.findByRole('link', { name: 'Anna Müller' })).toHaveAttribute('href', '/parents/3')
    expect(calls.map((call) => call.route)).toContain('PUT /api/children/7/parents/3')
  })

  it('lets an Admin record a new Parent and link them in one go', async () => {
    let linked = false
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': () => profile(linked ? [anna] : []),
      'GET /api/parents?search=': { status: 200, body: [] },
      'POST /api/parents': { status: 201, body: anna },
      'PUT /api/children/7/parents/3': () => {
        linked = true
        return { status: 204 }
      },
    })
    renderAt('/children/7/parents/add', <App />)

    const form = await screen.findByRole('form', { name: 'New Parent' })
    await userEvent.type(within(form).getByLabelText('First name'), 'Anna')
    await userEvent.type(within(form).getByLabelText('Last name'), 'Müller')
    await userEvent.type(within(form).getByLabelText('Address'), anna.address)
    await userEvent.type(within(form).getByLabelText('Phone'), anna.phone)
    await userEvent.type(within(form).getByLabelText('Email address'), anna.email)
    await userEvent.click(within(form).getByRole('button', { name: 'Save and link' }))

    expect(await screen.findByRole('region', { name: 'Parents' })).toHaveTextContent('Lindenstraße 12')
    const { id: _, ...details } = anna
    expect(calls).toContainEqual({ route: 'POST /api/parents', body: details })
  })

  it('lets an Admin remove a Parent from a Child', async () => {
    let linked = true
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': () => profile(linked ? [anna] : []),
      'DELETE /api/children/7/parents/3': () => {
        linked = false
        return { status: 204 }
      },
    })
    renderAt('/children/7', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Remove Anna Müller from this Child' }))

    expect(await screen.findByText('No Parents recorded.')).toBeInTheDocument()
  })

  it('shows a Parent with all their Children and lets an Admin edit them', async () => {
    let stored: Record<string, unknown> = anna
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/parents/3': () => ({
        status: 200,
        body: { ...stored, children: [{ id: 7, firstName: 'Lena', lastName: 'Müller' }, { id: 8, firstName: 'Max', lastName: 'Müller' }] },
      }),
      'PUT /api/parents/3': (body) => {
        stored = { id: 3, ...(body as object) }
        return { status: 200, body: stored }
      },
    })
    renderAt('/parents/3', <App />)

    expect(await screen.findByRole('link', { name: 'Max Müller' })).toHaveAttribute('href', '/children/8')
    await userEvent.click(screen.getByRole('link', { name: 'Edit' }))
    await userEvent.clear(screen.getByLabelText('Phone'))
    await userEvent.type(screen.getByLabelText('Phone'), '0171 555')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('link', { name: '0171 555' })).toBeInTheDocument()
    expect(calls).toContainEqual({ route: 'PUT /api/parents/3', body: { ...anna, id: undefined, phone: '0171 555' } })
  })
})
