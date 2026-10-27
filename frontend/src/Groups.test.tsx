// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, noProfileLists, renderAt, sessionAs } from './testing'

const monkeys = { id: 5, name: 'Monkeys', icon: 'monkey' }
const bees = { id: 6, name: 'Bees', icon: 'bee' }
const owls = { id: 7, name: 'Owls', icon: 'owl' }
const lena = { id: 7, firstName: 'Lena', lastName: 'Müller', gender: null, languages: '', foodPreferences: '', interests: '' }

afterEach(() => localStorage.clear())

describe('Groups', () => {
  it('lets an Admin create a Group with a name and an icon', async () => {
    let created = false
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/groups': () => ({ status: 200, body: created ? [{ ...bees, mine: false }] : [] }),
      'POST /api/groups': () => {
        created = true
        return { status: 201, body: bees }
      },
    })
    renderAt('/groups', <App />)

    const form = await screen.findByRole('form', { name: 'New Group' })
    await userEvent.type(within(form).getByLabelText('Name'), 'Bees')
    await userEvent.click(within(form).getByRole('radio', { name: 'Bee' }))
    await userEvent.click(within(form).getByRole('button', { name: 'Create Group' }))

    expect(await screen.findByRole('heading', { name: 'Bees', level: 3 })).toBeInTheDocument()
    expect(calls).toContainEqual({ route: 'POST /api/groups', body: { name: 'Bees', icon: 'bee' } })
  })

  it('lets an Admin rename a Group, and remove it after asking', async () => {
    let listed = [{ ...monkeys, mine: false }]
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/groups': () => ({ status: 200, body: listed }),
      'PUT /api/groups/5': (body) => {
        listed = [{ ...monkeys, ...(body as object), mine: false }]
        return { status: 200, body: listed[0] }
      },
      'DELETE /api/groups/5': () => {
        listed = []
        return { status: 204 }
      },
    })
    renderAt('/groups', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Change Monkeys' }))
    const form = screen.getByRole('form', { name: 'Change Monkeys' })
    await userEvent.clear(within(form).getByLabelText('Name'))
    await userEvent.type(within(form).getByLabelText('Name'), 'Little Monkeys')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('heading', { name: 'Little Monkeys' })).toBeInTheDocument()
    expect(calls).toContainEqual({ route: 'PUT /api/groups/5', body: { name: 'Little Monkeys', icon: 'monkey' } })

    await userEvent.click(screen.getByRole('button', { name: 'Remove Little Monkeys' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove for good' }))
    expect(await screen.findByText('No Groups yet.')).toBeInTheDocument()
  })

  it('takes a Staff member from the start page to their Group dashboard, and remembers it', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/groups': { status: 200, body: [{ ...bees, mine: false }, { ...monkeys, mine: true }, { ...owls, mine: false }] },
      'GET /api/groups/5': { status: 200, body: { ...monkeys, children: [{ id: 7, firstName: 'Lena', lastName: 'Müller' }] } },
    })
    const { unmount } = renderAt('/', <App />)

    const picker = await screen.findByLabelText('Group')
    // The Staff member's own Groups first.
    expect(within(picker).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Choose a Group',
      '🐒 Monkeys',
      '🐝 Bees',
      '🦉 Owls',
    ])
    await userEvent.selectOptions(picker, '5')

    expect(await screen.findByRole('heading', { name: 'Monkeys', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lena Müller' })).toHaveAttribute('href', '/children/7')
    unmount()

    renderAt('/', <App />)
    expect(await screen.findByRole('link', { name: 'Open Monkeys' })).toHaveAttribute('href', '/groups/5')
  })

  it('says when a Group has no Children yet', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/groups': { status: 200, body: [{ ...owls, mine: false }] },
      'GET /api/groups/7': { status: 200, body: { ...owls, children: [] } },
    })
    renderAt('/groups/7', <App />)

    expect(await screen.findByText('No Children in this Group yet.')).toBeInTheDocument()
  })

  it('shows a Child’s Group on the profile, and lets an Admin move them', async () => {
    let group: typeof monkeys | null = monkeys
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/groups': { status: 200, body: [{ ...bees, mine: false }, { ...monkeys, mine: false }] },
      'GET /api/children/7': () => ({ status: 200, body: { ...lena, ...noProfileLists, group } }),
      'PUT /api/children/7/group': (body) => {
        group = (body as { groupId: number | null }).groupId === 6 ? bees : null
        return { status: 204 }
      },
    })
    renderAt('/children/7', <App />)

    const choice = await screen.findByLabelText('Group')
    expect(choice).toHaveValue('5')
    await within(choice).findByRole('option', { name: '🐝 Bees' })
    await userEvent.selectOptions(choice, '6')
    await userEvent.selectOptions(choice, '')

    expect(calls).toContainEqual({ route: 'PUT /api/children/7/group', body: { groupId: 6 } })
    expect(calls).toContainEqual({ route: 'PUT /api/children/7/group', body: { groupId: null } })
    expect(await screen.findByLabelText('Group')).toHaveValue('')
  })

  it('shows Teachers a Child’s Group without changing it', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/children/7': { status: 200, body: { ...lena, ...noProfileLists, group: monkeys } },
    })
    renderAt('/children/7', <App />)

    expect(await screen.findByRole('link', { name: 'Monkeys' })).toHaveAttribute('href', '/groups/5')
    expect(screen.queryByLabelText('Group')).toBeNull()
  })

  it('lets an Admin say which Groups a Staff member works in', async () => {
    const teacher = { id: 2, email: 'erzieherin@kita.example', role: 'teacher', status: 'active', groupIds: [6] }
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/staff': { status: 200, body: [teacher] },
      'GET /api/groups': { status: 200, body: [{ ...bees, mine: false }, { ...monkeys, mine: false }] },
      'PUT /api/staff/2/groups': (body) => ({ status: 200, body: { ...teacher, ...(body as object) } }),
    })
    renderAt('/staff', <App />)

    const groups = await screen.findByRole('group', { name: 'Groups of erzieherin@kita.example' })
    expect(within(groups).getByRole('checkbox', { name: 'Bees' })).toBeChecked()
    await userEvent.click(within(groups).getByRole('checkbox', { name: 'Monkeys' }))

    expect(calls).toContainEqual({ route: 'PUT /api/staff/2/groups', body: { groupIds: [6, 5] } })
    expect(await within(groups).findByRole('checkbox', { name: 'Monkeys' })).toBeChecked()
  })
})
