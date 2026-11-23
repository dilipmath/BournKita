// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { fakeApi, health, noProfileLists, renderAt, sessionAs } from './testing'

const lena = {
  id: 7,
  firstName: 'Lena',
  lastName: 'Müller',
  gender: 'girl',
  languages: 'Deutsch, Türkisch',
  foodPreferences: 'Vegetarisch',
  interests: 'Malen, Dinosaurier',
  dateOfBirth: null,
  symbol: 'kite',
}
// As the list gives them: with their Group (null: none) and Alerts.
const lenaSummary = { id: 7, firstName: 'Lena', lastName: 'Müller', symbol: 'kite', groupId: null, alerts: [] }
const mia = { id: 8, firstName: 'Mia', lastName: 'Schmidt', symbol: 'boat', groupId: null, alerts: [] }
const monkeys = { id: 2, name: 'Monkeys', icon: 'monkey', colour: 'orange', mine: true }
const peanuts = { id: 21, kind: 'allergy', name: 'Peanuts', note: '' }

describe('child profiles', () => {
  it('lists the Children and searches them by name', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/children?search=&withAlerts=true': { status: 200, body: [lenaSummary, mia] },
      'GET /api/children?search=lena&withAlerts=true': { status: 200, body: [lenaSummary] },
    })
    renderAt('/', <App />)

    await userEvent.click(await screen.findByRole('link', { name: 'Children' }))
    // Each by their Symbol and name; the Symbol is not read out before the name.
    const miaLink = await screen.findByRole('link', { name: 'Mia Schmidt' })
    expect(within(miaLink).getByLabelText('Boat')).toHaveAttribute('aria-hidden', 'true')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search by name' }), 'lena')

    // Once typing pauses.
    await expect.poll(() => screen.queryByRole('link', { name: 'Mia Schmidt' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Lena Müller' })).toBeInTheDocument()
  })

  it('lists the Children by Group, those in none under No Group, with their Alerts flagged', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/groups': { status: 200, body: [monkeys] },
      'GET /api/children?search=&withAlerts=true': { status: 200, body: [{ ...lenaSummary, groupId: 2, alerts: [peanuts] }, mia] },
    })
    renderAt('/children', <App />)

    const inMonkeys = await screen.findByRole('region', { name: 'Monkeys' })
    expect(within(inMonkeys).getByRole('link', { name: 'Lena Müller' })).toHaveAccessibleDescription('Alerts: Peanuts')
    const inNoGroup = screen.getByRole('region', { name: 'No Group' })
    expect(within(inNoGroup).getByRole('link', { name: 'Mia Schmidt' })).toHaveAttribute('href', '/children/8')
  })

  it('filters the Children by the Group chosen in the top bar', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/groups': { status: 200, body: [monkeys] },
      'GET /api/children?search=&withAlerts=true': { status: 200, body: [{ ...lenaSummary, groupId: 2, alerts: [] }, mia] },
      'GET /api/children?search=&groupId=2&withAlerts=true': { status: 200, body: [{ ...lenaSummary, groupId: 2, alerts: [] }] },
    })
    renderAt('/children', <App />)
    expect(await screen.findByRole('link', { name: 'Mia Schmidt' })).toBeInTheDocument()

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Current Group' }), '2')

    // Still the Children list, now the Monkeys' only.
    await expect.poll(() => screen.queryByRole('link', { name: 'Mia Schmidt' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Children' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lena Müller' })).toBeInTheDocument()
  })

  it('lets an Admin create a Child profile and then shows it', async () => {
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children?search=&withAlerts=true': { status: 200, body: [] },
      'POST /api/children': { status: 201, body: lena },
      'GET /api/children/7': { status: 200, body: { ...lena, ...noProfileLists } },
    })
    renderAt('/children', <App />)

    await userEvent.click(await screen.findByRole('link', { name: 'Add Child' }))
    await userEvent.type(screen.getByLabelText('First name'), 'Lena')
    await userEvent.type(screen.getByLabelText('Last name'), 'Müller')
    await userEvent.selectOptions(screen.getByLabelText('Gender'), 'girl')
    await userEvent.type(screen.getByLabelText('Languages spoken'), 'Deutsch, Türkisch')
    await userEvent.type(screen.getByLabelText('Food preferences'), 'Vegetarisch')
    await userEvent.type(screen.getByLabelText('Interests'), 'Malen, Dinosaurier')
    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Symbol' })).getByRole('radio', { name: 'Kite' }))
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
      'GET /api/children/7': () => ({ status: 200, body: { ...stored, ...noProfileLists } }),
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

  it('archives a Child profile only after the Admin confirms', async () => {
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': { status: 200, body: { ...lena, ...noProfileLists } },
      'DELETE /api/children/7': { status: 204 },
      'GET /api/children?search=&withAlerts=true': { status: 200, body: [mia] },
    })
    renderAt('/children/7', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Archive' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(calls.map((call) => call.route)).not.toContain('DELETE /api/children/7')

    await userEvent.click(screen.getByRole('button', { name: 'Archive' }))
    await userEvent.click(screen.getByRole('button', { name: 'Archive profile' }))

    // The drawer closes onto the list, which says so.
    expect(await screen.findByRole('status')).toHaveTextContent('The profile of Lena Müller is in the Archive.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByRole('link', { name: 'Mia Schmidt' })).toBeInTheDocument()
  })

  it('shows Teachers the profile without ways to change it', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/children/7': { status: 200, body: { ...lena, ...noProfileLists } },
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
      'GET /api/children?search=&withAlerts=true': { status: 200, body: [lenaSummary] },
    })
    renderAt('/children', <App />)

    expect(await screen.findByRole('link', { name: 'Lena Müller' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Add Child' })).toBeNull()
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

  it('moves focus to the question when an Admin starts archiving', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': { status: 200, body: { ...lena, ...noProfileLists } },
    })
    renderAt('/children/7', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Archive' }))

    expect(screen.getByRole('group', { name: 'Archive profile' })).toHaveFocus()
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

  it('marks the symbols other Children in the Group already have', async () => {
    const monkeys = { id: 5, name: 'Monkeys', icon: 'monkey', colour: 'orange' }
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': { status: 200, body: { ...lena, ...noProfileLists, group: monkeys } },
      'GET /api/children?search=&groupId=5': { status: 200, body: [lenaSummary, { ...mia, symbol: 'boat' }] },
    })
    renderAt('/children/7/edit', <App />)

    const symbols = await screen.findByRole('radiogroup', { name: 'Symbol' })
    expect(await within(symbols).findByRole('radio', { name: 'Boat (taken in this Group)' })).toBeInTheDocument()
    // The Child's own is not taken.
    expect(within(symbols).getByRole('radio', { name: 'Kite' })).toBeChecked()
  })

  it('says when another Child in the Group already has the chosen symbol', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': { status: 200, body: { ...lena, ...noProfileLists } },
      'PUT /api/children/7': { status: 409, body: { detail: 'symbol_taken' } },
    })
    renderAt('/children/7/edit', <App />)

    await userEvent.click(within(await screen.findByRole('radiogroup', { name: 'Symbol' })).getByRole('radio', { name: 'Boat' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Another Child in this Group has this symbol. Please choose another.')
  })
})

describe('the Child profile drawer', () => {
  const monkeysGroup = { id: 2, name: 'Monkeys', icon: 'monkey', colour: 'orange' }
  const profile = { ...lena, ...noProfileLists, dateOfBirth: '2022-03-14', group: monkeysGroup }

  function drawerApi(role: 'admin' | 'teacher', routes: Record<string, { status: number; body?: unknown }> = {}) {
    return fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs(role),
      'GET /api/children?search=&withAlerts=true': { status: 200, body: [{ ...lenaSummary, groupId: 2, alerts: [] }, mia] },
      'GET /api/children/7': { status: 200, body: profile },
      ...routes,
    })
  }

  it('opens over the list, headed by the Child, with the sections in order, and Close goes back to their tag', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-01-04T09:00:00+01:00'))
    drawerApi('teacher')
    renderAt('/children', <App />)

    await userEvent.click(await screen.findByRole('link', { name: 'Lena Müller' }))

    const drawer = await screen.findByRole('dialog', { name: 'Lena Müller' })
    expect(drawer).toHaveTextContent('4 years old')
    expect(drawer).toHaveTextContent('Monkeys')
    expect(within(drawer).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Allergies and medical conditions',
      'Parents',
      'Emergency contacts',
      'Who may pick up',
      'Consents',
      'Food preferences',
      'Languages spoken',
      'Details',
      'Absences',
      'Photos',
    ])
    // The list stays behind it.
    expect(screen.getByRole('link', { name: 'Mia Schmidt', hidden: true })).toBeInTheDocument()

    await userEvent.click(within(drawer).getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('link', { name: 'Lena Müller' })).toHaveFocus()
    vi.useRealTimers()
  })

  it('opens straight away at the Child’s address, over the list', async () => {
    drawerApi('teacher')
    renderAt('/children/7', <App />)

    expect(await screen.findByRole('dialog', { name: 'Lena Müller' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Mia Schmidt', hidden: true })).toBeInTheDocument()
  })

  it('tells a Teacher that the Leitung makes changes, and gives an Admin Edit', async () => {
    drawerApi('teacher')
    const { unmount } = renderAt('/children/7', <App />)
    const forTeacher = await screen.findByRole('dialog', { name: 'Lena Müller' })
    expect(forTeacher).toHaveTextContent('Changes to the profile are made by an Admin.')
    expect(within(forTeacher).queryByRole('link', { name: 'Edit' })).toBeNull()
    unmount()

    drawerApi('admin')
    renderAt('/children/7', <App />)
    const forAdmin = await screen.findByRole('dialog', { name: 'Lena Müller' })
    expect(within(forAdmin).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/children/7/edit')
    expect(forAdmin).not.toHaveTextContent('Changes to the profile are made by an Admin.')
  })

  it('names the Retention period before an Admin archives a Child, who then leaves the list', async () => {
    let archived = false
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children?search=&withAlerts=true': () => ({ status: 200, body: archived ? [mia] : [{ ...lenaSummary, groupId: 2, alerts: [] }, mia] }),
      'GET /api/children/7': { status: 200, body: profile },
      'DELETE /api/children/7': () => {
        archived = true
        return { status: 204 }
      },
    })
    renderAt('/children/7', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Archive' }))

    expect(screen.getByRole('group', { name: 'Archive profile' })).toHaveTextContent(
      'Archive the profile of Lena Müller? It stays in the Archive for 12 months and can be restored.',
    )
    expect(calls.map((call) => call.route)).not.toContain('DELETE /api/children/7')
    await userEvent.click(screen.getByRole('button', { name: 'Archive profile' }))
    expect(await screen.findByRole('status')).toHaveTextContent('The profile of Lena Müller is in the Archive.')
    await expect.poll(() => screen.queryByRole('link', { name: 'Lena Müller' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Mia Schmidt' })).toBeInTheDocument()
  })

  it('shows the whole list for a Group the address names that does not exist', async () => {
    drawerApi('teacher')
    renderAt('/children?group=abc', <App />)

    expect(await screen.findByRole('link', { name: 'Mia Schmidt' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
