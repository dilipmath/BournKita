// @vitest-environment happy-dom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const lena = {
  id: 7,
  firstName: 'Lena',
  lastName: 'Müller',
  gender: 'girl',
  languages: 'Deutsch, Türkisch',
  foodPreferences: 'Vegetarisch',
  interests: 'Malen, Dinosaurier',
}
const lenaSummary = { id: 7, firstName: 'Lena', lastName: 'Müller' }
const mia = { id: 8, firstName: 'Mia', lastName: 'Schmidt' }

describe('child profiles', () => {
  it('lists the Children and searches them by name', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/children?search=': { status: 200, body: [lenaSummary, mia] },
      'GET /api/children?search=lena': { status: 200, body: [lenaSummary] },
    })
    renderAt('/', <App />)

    await userEvent.click(await screen.findByRole('link', { name: 'Children' }))
    expect(await screen.findByRole('link', { name: 'Mia Schmidt' })).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search by name' }), 'lena')

    expect(await screen.findByRole('link', { name: 'Lena Müller' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Mia Schmidt' })).toBeNull()
  })

  it('lets an Admin create a Child profile and then shows it', async () => {
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children?search=': { status: 200, body: [] },
      'POST /api/children': { status: 201, body: lena },
      'GET /api/children/7': { status: 200, body: lena },
    })
    renderAt('/children', <App />)

    await userEvent.click(await screen.findByRole('link', { name: 'New Child profile' }))
    await userEvent.type(screen.getByLabelText('First name'), 'Lena')
    await userEvent.type(screen.getByLabelText('Last name'), 'Müller')
    await userEvent.selectOptions(screen.getByLabelText('Gender'), 'girl')
    await userEvent.type(screen.getByLabelText('Languages spoken'), 'Deutsch, Türkisch')
    await userEvent.type(screen.getByLabelText('Food preferences'), 'Vegetarisch')
    await userEvent.type(screen.getByLabelText('Interests'), 'Malen, Dinosaurier')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('heading', { name: 'Lena Müller' })).toBeInTheDocument()
    expect(screen.getByText('Girl')).toBeInTheDocument()
    expect(screen.getByText('Malen, Dinosaurier')).toBeInTheDocument()
    const { id: _, ...details } = lena
    expect(calls).toContainEqual({ route: 'POST /api/children', body: details })
  })

  it('lets an Admin edit a Child profile', async () => {
    let stored: Record<string, unknown> = lena
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': () => ({ status: 200, body: stored }),
      'PUT /api/children/7': (body) => {
        stored = { id: 7, ...(body as object) }
        return { status: 200, body: stored }
      },
    })
    renderAt('/children/7', <App />)

    await userEvent.click(await screen.findByRole('link', { name: 'Edit' }))
    await userEvent.clear(screen.getByLabelText('Last name'))
    await userEvent.type(screen.getByLabelText('Last name'), 'Müller-Yılmaz')
    await userEvent.selectOptions(screen.getByLabelText('Gender'), '')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('heading', { name: 'Lena Müller-Yılmaz' })).toBeInTheDocument()
    expect(screen.getByText('Not stated')).toBeInTheDocument()
    const { id: _, ...details } = lena
    expect(calls).toContainEqual({
      route: 'PUT /api/children/7',
      body: { ...details, lastName: 'Müller-Yılmaz', gender: null },
    })
  })

  it('deletes a Child profile only after the Admin confirms', async () => {
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': { status: 200, body: lena },
      'DELETE /api/children/7': { status: 204 },
      'GET /api/children?search=': { status: 200, body: [mia] },
    })
    renderAt('/children/7', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Really delete the profile of Lena Müller? This cannot be undone.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(calls.map((call) => call.route)).not.toContain('DELETE /api/children/7')

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete profile' }))

    expect(await screen.findByRole('status')).toHaveTextContent('The profile of Lena Müller was deleted.')
    expect(screen.getByRole('link', { name: 'Mia Schmidt' })).toBeInTheDocument()
  })

  it('shows Teachers the profile without ways to change it', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/children/7': { status: 200, body: lena },
    })
    renderAt('/children/7', <App />)

    expect(await screen.findByRole('heading', { name: 'Lena Müller' })).toBeInTheDocument()
    expect(screen.getByText('Vegetarisch')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('does not offer Teachers a new profile, even at its address', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/children?search=': { status: 200, body: [lenaSummary] },
    })
    renderAt('/children', <App />)

    expect(await screen.findByRole('link', { name: 'Lena Müller' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'New Child profile' })).toBeNull()
  })

  it('shows Teachers who open the address of a new profile the Admins-only notice', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('teacher') })
    renderAt('/children/new', <App />)

    expect(await screen.findByText('Only Admins can change Child profiles.')).toBeInTheDocument()
    expect(screen.queryByLabelText('First name')).toBeNull()
  })

  it('says a profile does not exist rather than failing on a broken address', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': sessionAs('teacher') })
    renderAt('/children/abc', <App />)

    expect(await screen.findByText('This entry no longer exists.')).toBeInTheDocument()
  })

  it('moves focus to the question when an Admin starts deleting', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': { status: 200, body: lena },
    })
    renderAt('/children/7', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(screen.getByRole('group', { name: 'Delete profile' })).toHaveFocus()
  })

  it('explains a missing name the server refused', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'POST /api/children': { status: 422, body: { detail: 'name_required' } },
    })
    renderAt('/children/new', <App />)

    await userEvent.type(await screen.findByLabelText('First name'), ' ')
    await userEvent.type(screen.getByLabelText('Last name'), ' ')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter a first and a last name.')
  })
})
