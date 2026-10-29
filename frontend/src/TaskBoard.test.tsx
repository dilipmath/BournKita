// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const monkeys = { id: 2, name: 'Monkeys', icon: 'monkey', mine: true }
const unplanned = { assignee: null, dueOn: null, labels: [] }
const smocks = { id: 31, title: 'Wash the painting smocks', note: 'Before Friday', status: 'toDo', ...unplanned }
const plants = { id: 32, title: 'Water the plants', note: '', status: 'doing', ...unplanned }
const lantern = { id: 33, title: 'Lantern festival', note: '', status: 'done', ...unplanned }

type Task = { id: number; title: string; note: string; status: string }

/** The fake API of one Group's Task board, keeping its Tasks in `tasks`. */
function boardApi(tasks: Task[]) {
  const state = { tasks }
  const calls = fakeApi({
    'GET /api/health': health,
    'GET /api/session': sessionAs('teacher'),
    'GET /api/groups': { status: 200, body: [monkeys] },
    'GET /api/groups/2/assignees': { status: 200, body: [] },
    'GET /api/groups/2/tasks': () => ({ status: 200, body: state.tasks }),
    'POST /api/groups/2/tasks': (body) => {
      const added = { ...(body as Task), id: 40, status: 'toDo' }
      state.tasks = [...state.tasks, added]
      return { status: 201, body: added }
    },
    'PUT /api/groups/2/tasks/31': (body) => {
      state.tasks = state.tasks.map((task) => (task.id === 31 ? { ...task, ...(body as Task) } : task))
      return { status: 200, body: state.tasks.find((task) => task.id === 31) }
    },
    'PUT /api/groups/2/tasks/31/status': (body) => {
      state.tasks = state.tasks.map((task) => (task.id === 31 ? { ...task, ...(body as Task) } : task))
      return { status: 204 }
    },
    'DELETE /api/groups/2/tasks/31': () => {
      state.tasks = state.tasks.filter((task) => task.id !== 31)
      return { status: 204 }
    },
  })
  return calls
}

function column(name: string) {
  return screen.getByRole('region', { name })
}

describe('Task board', () => {
  it('shows a Group’s Tasks in To do, Doing and Done', async () => {
    boardApi([smocks, plants, lantern])
    renderAt('/groups/2/board', <App />)

    expect(await screen.findByRole('heading', { name: 'Task board: Monkeys' })).toBeInTheDocument()
    expect(await within(column('To do')).findByText('Wash the painting smocks')).toBeInTheDocument()
    expect(column('To do')).toHaveTextContent('Before Friday')
    expect(within(column('Doing')).getByText('Water the plants')).toBeInTheDocument()
    expect(within(column('Done')).getByText('Lantern festival')).toBeInTheDocument()
  })

  it('is reached from the Group dashboard', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/groups/2': { status: 200, body: { ...monkeys, day: '2027-01-04', children: [] } },
    })
    renderAt('/groups/2', <App />)

    expect(await screen.findByRole('link', { name: 'Task board' })).toHaveAttribute('href', '/groups/2/board')
  })

  it('lets a Teacher add a Task to To do', async () => {
    const calls = boardApi([])
    renderAt('/groups/2/board', <App />)

    await userEvent.click(await within(await screen.findByRole('region', { name: 'To do' })).findByRole('button', { name: 'Add task' }))
    const form = screen.getByRole('form', { name: 'Add task' })
    await userEvent.type(within(form).getByLabelText('Title'), 'Wash the painting smocks')
    await userEvent.type(within(form).getByLabelText('Note'), 'Before Friday')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await within(column('To do')).findByText('Wash the painting smocks')).toBeInTheDocument()
    expect(calls).toContainEqual({ route: 'POST /api/groups/2/tasks', body: { title: 'Wash the painting smocks', note: 'Before Friday', assigneeId: null, dueOn: null, labels: [] } })
  })

  it('lets a Teacher move a Task to another column without dragging', async () => {
    const calls = boardApi([smocks])
    renderAt('/groups/2/board', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Move Wash the painting smocks to Doing' }))

    expect(await within(column('Doing')).findByText('Wash the painting smocks')).toBeInTheDocument()
    expect(within(column('To do')).queryByText('Wash the painting smocks')).toBeNull()
    expect(calls).toContainEqual({ route: 'PUT /api/groups/2/tasks/31/status', body: { status: 'doing' } })
  })

  it('lets a Teacher change and delete a Task', async () => {
    const calls = boardApi([smocks])
    renderAt('/groups/2/board', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Change Wash the painting smocks' }))
    const form = screen.getByRole('form', { name: 'Change Wash the painting smocks' })
    await userEvent.clear(within(form).getByLabelText('Title'))
    await userEvent.type(within(form).getByLabelText('Title'), 'Wash the smocks')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))
    expect(await within(column('To do')).findByText('Wash the smocks')).toBeInTheDocument()
    expect(calls).toContainEqual({ route: 'PUT /api/groups/2/tasks/31', body: { title: 'Wash the smocks', note: 'Before Friday', assigneeId: null, dueOn: null, labels: [] } })

    await userEvent.click(screen.getByRole('button', { name: 'Delete Wash the smocks' }))
    // A second, deliberate tap: one stray tap must not lose a Task.
    const confirm = screen.getByRole('group', { name: 'Delete Wash the smocks' })
    expect(confirm).toHaveTextContent('Really delete “Wash the smocks”?')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    expect(calls.map((call) => call.route)).not.toContain('DELETE /api/groups/2/tasks/31')

    await userEvent.click(screen.getByRole('button', { name: 'Delete Wash the smocks' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Delete Wash the smocks' })).getByRole('button', { name: 'Delete' }))
    expect(await within(column('To do')).findByText('No tasks.')).toBeInTheDocument()
  })
})
