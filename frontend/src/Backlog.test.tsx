// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const monkeys = { id: 2, name: 'Monkeys', icon: 'monkey', mine: true }
const teacher = { id: 5, email: 'teacher@kita.example' }
const unplanned = { assignee: null, dueOn: null, labels: [] }
const smocks = { id: 31, title: 'Wash the smocks', note: '', status: 'toDo', ...unplanned }
const plants = {
  id: 32,
  title: 'Water the plants',
  note: '',
  status: 'toDo',
  assignee: teacher,
  dueOn: '2027-01-08',
  labels: ['Garden'],
}
const lanterns = { id: 33, title: 'Buy lantern paper', note: '', status: 'toDo', ...unplanned }
const festival = { id: 34, title: 'Lantern festival', note: '', status: 'doing', ...unplanned }

type Task = typeof smocks | typeof plants

/** The fake API of one Group's Tasks, keeping them in `state.tasks`. */
function tasksApi(tasks: Task[]) {
  const state = { tasks }
  const calls = fakeApi({
    'GET /api/health': health,
    'GET /api/session': sessionAs('teacher'),
    'GET /api/groups': { status: 200, body: [monkeys] },
    'GET /api/groups/2/assignees': { status: 200, body: [teacher] },
    'GET /api/groups/2/tasks': () => ({ status: 200, body: state.tasks }),
    'PUT /api/groups/2/backlog': (body) => {
      const { taskIds } = body as { taskIds: number[] }
      state.tasks = taskIds.map((id) => state.tasks.find((task) => task.id === id)!).concat(state.tasks.filter((task) => task.status !== 'toDo'))
      return { status: 204 }
    },
    'PUT /api/groups/2/tasks/31': (body) => {
      const changed = body as { assigneeId: number | null; dueOn: string | null; labels: string[] }
      state.tasks = state.tasks.map((task) =>
        task.id === 31 ? { ...task, ...changed, assignee: changed.assigneeId === 5 ? teacher : null } : task,
      ) as Task[]
      return { status: 200, body: state.tasks.find((task) => task.id === 31) }
    },
  })
  return calls
}

function backlogItems() {
  return within(screen.getByRole('list', { name: 'Backlog' }))
    .getAllByRole('listitem')
    .map((item) => item.querySelector('strong')?.textContent)
}

describe('Backlog', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-01-11T09:00:00+01:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('lists the To do Tasks, most important first, with who does them, when and labels', async () => {
    tasksApi([smocks, plants, festival])
    renderAt('/groups/2/backlog', <App />)

    expect(await screen.findByRole('heading', { name: 'Backlog: Monkeys' })).toBeInTheDocument()
    expect(await screen.findByText('Wash the smocks')).toBeInTheDocument()
    expect(backlogItems()).toEqual(['Wash the smocks', 'Water the plants'])
    const [first, second] = within(screen.getByRole('list', { name: 'Backlog' })).getAllByRole('listitem')
    expect(first).toHaveTextContent('#1')
    expect(second).toHaveTextContent('#2')
    expect(second).toHaveTextContent('teacher@kita.example')
    // Due on 8 January, and today is the 11th.
    expect(second).toHaveTextContent('Overdue')
    expect(second).toHaveTextContent('Garden')
    expect(screen.queryByText('Lantern festival')).toBeNull()
  })

  it('lets staff move a Task up or down', async () => {
    const calls = tasksApi([smocks, plants, lanterns])
    renderAt('/groups/2/backlog', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Move Buy lantern paper up' }))
    expect(await screen.findByText('#1')).toBeInTheDocument()
    await vi.waitFor(() => expect(backlogItems()).toEqual(['Wash the smocks', 'Buy lantern paper', 'Water the plants']))
    expect(calls).toContainEqual({ route: 'PUT /api/groups/2/backlog', body: { taskIds: [31, 33, 32] } })

    await userEvent.click(screen.getByRole('button', { name: 'Move Wash the smocks down' }))
    await vi.waitFor(() => expect(backlogItems()).toEqual(['Buy lantern paper', 'Wash the smocks', 'Water the plants']))
    // The first cannot go further up, nor the last further down.
    expect(screen.queryByRole('button', { name: 'Move Buy lantern paper up' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Move Water the plants down' })).toBeNull()
  })

  it('says so when someone else changed the backlog meanwhile', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/groups': { status: 200, body: [monkeys] },
      'GET /api/groups/2/tasks': { status: 200, body: [smocks, lanterns] },
      'PUT /api/groups/2/backlog': { status: 409, body: { detail: 'backlog_changed' } },
    })
    renderAt('/groups/2/backlog', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Move Buy lantern paper up' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Someone else changed the Backlog meanwhile. Here it is as it is now.')
  })

  it('lets staff give a Task to someone in the Group, with a due date and labels', async () => {
    const calls = tasksApi([smocks])
    renderAt('/groups/2/board', <App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Change Wash the smocks' }))
    const form = screen.getByRole('form', { name: 'Change Wash the smocks' })
    await userEvent.selectOptions(await within(form).findByLabelText('Who does it'), 'teacher@kita.example')
    await userEvent.type(within(form).getByLabelText('Due on'), '2027-01-15')
    await userEvent.type(within(form).getByLabelText('Labels (separated by commas)'), 'Laundry, Art')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(calls).toContainEqual({
      route: 'PUT /api/groups/2/tasks/31',
      body: { title: 'Wash the smocks', note: '', assigneeId: 5, dueOn: '2027-01-15', labels: ['Laundry', 'Art'] },
    })
    const card = (await screen.findByText('teacher@kita.example')).closest('li')!
    expect(card).toHaveTextContent('Laundry')
    expect(card).not.toHaveTextContent('Overdue')
  })
})
