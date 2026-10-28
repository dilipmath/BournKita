import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { addTask, fetchTasks, moveTask, removeTask, taskStatusLabel, updateTask, type Task, type TaskStatus } from './api'
import GroupLabel from './GroupLabel'
import ProblemAlert from './ProblemAlert'
import { useProfileChange } from './profileChange'
import { useRecordAtAddress } from './recordAtAddress'
import RecordPlaceholder from './RecordPlaceholder'
import TaskForm from './TaskForm'
import TaskPlan from './TaskPlan'
import { useAssignees } from './useAssignees'
import { useGroups } from './useGroups'
import { dataAt, usePointerDrag } from './usePointerDrag'

const statuses = Object.keys(taskStatusLabel) as TaskStatus[]

/** A Group's Task board: its Tasks in To do, Doing and Done. Staff members add, change, move
 * (by dragging, or with the Move buttons) and delete them here. */
export default function TaskBoardPage() {
  const { t } = useTranslation()
  const groupId = Number(useParams().id)
  const [loaded, reload] = useRecordAtAddress(fetchTasks)
  const group = useGroups()?.find((listed) => listed.id === groupId)
  const assignees = useAssignees(groupId)
  const { problem, change } = useProfileChange(reload)
  // The Task being changed, or 'new' while one is added.
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  // The Task whose deletion is waiting to be confirmed.
  const [confirming, setConfirming] = useState<number | null>(null)
  // A move shown until the board reloads, so a dropped Task stays where it was dropped; it
  // applies only to the board loaded when it was made.
  const [shownMove, setShownMove] = useState<{ on: Task[]; taskId: number; status: TaskStatus } | null>(null)
  const { handleProps, dragging } = usePointerDrag(
    (x, y) => dataAt(x, y, 'status') as TaskStatus | null,
    (taskId, status) => {
      // Let go over its own column, it stays where it is.
      const task = tasks?.find((each) => each.id === taskId)
      if (task && statusOf(task) !== status) void move(taskId, status)
    },
  )

  const tasks = loaded.record
  if (!tasks) return <RecordPlaceholder {...loaded} backTo={{ to: '/', label: t('backToStart') }} />
  const statusOf = (task: Task) => (shownMove?.on === tasks && shownMove.taskId === task.id ? shownMove.status : task.status)

  async function move(taskId: number, status: TaskStatus) {
    if (tasks) setShownMove({ on: tasks, taskId, status })
    // Failed, it goes back to where it was.
    if (!(await change(() => moveTask(groupId, taskId, status)))) setShownMove(null)
  }

  async function save(call: () => Promise<unknown>) {
    const saved = await change(call)
    if (saved) setEditing(null)
    return saved
  }

  function card(task: Task, status: TaskStatus) {
    if (editing === task.id) {
      return (
        <li key={task.id}>
          <TaskForm
            label={t('changeNamed', { name: task.title })}
            task={task}
            assignees={assignees}
            onSave={(details) => save(() => updateTask(groupId, task.id, details))}
            onCancel={() => setEditing(null)}
          />
        </li>
      )
    }
    const isDragged = dragging?.id === task.id
    return (
      <li
        key={task.id}
        className={isDragged ? 'task dragging' : 'task'}
        style={isDragged ? { transform: `translate(${dragging.dx}px, ${dragging.dy}px)` } : undefined}
      >
        <div className="task-title">
          {/* For pointers only: keyboards and screen readers use the Move buttons. */}
          <span className="drag-handle" aria-hidden="true" {...handleProps(task.id)}>
            ⠿
          </span>
          <strong>{task.title}</strong>
        </div>
        {task.note && <p className="note">{task.note}</p>}
        <TaskPlan task={task} />
        {confirming === task.id ? (
          // A second, deliberate step, so one stray tap does not lose a Task.
          <div className="confirm" role="group" aria-label={t('deleteNamed', { name: task.title })}>
            <p>{t('confirmDeleteTask', { title: task.title })}</p>
            <div className="actions">
              <button type="button" className="danger" onClick={() => void change(() => removeTask(groupId, task.id))}>
                {t('delete')}
              </button>
              {/* Focused, so the safe choice is the one already picked. */}
              <button type="button" autoFocus onClick={() => setConfirming(null)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="actions">
            {statuses
              .filter((other) => other !== status)
              .map((other) => (
                <button
                  key={other}
                  type="button"
                  aria-label={t('moveNamedTo', { name: task.title, column: t(taskStatusLabel[other]) })}
                  onClick={() => void move(task.id, other)}
                >
                  → {t(taskStatusLabel[other])}
                </button>
              ))}
            <button type="button" aria-label={t('changeNamed', { name: task.title })} onClick={() => setEditing(task.id)}>
              {t('edit')}
            </button>
            <button type="button" aria-label={t('deleteNamed', { name: task.title })} onClick={() => setConfirming(task.id)}>
              {t('delete')}
            </button>
          </div>
        )}
      </li>
    )
  }

  return (
    <section className="page task-board">
      <nav className="actions" aria-label={t('taskViews')}>
        <Link to={`/groups/${groupId}`}>{t('backToGroup')}</Link>
        <Link className="button" to={`/groups/${groupId}/backlog`}>
          {t('backlog')}
        </Link>
      </nav>
      <h2>
        {t('taskBoard')}
        {group && (
          <>
            {': '}
            <GroupLabel group={group} />
          </>
        )}
      </h2>
      <ProblemAlert problem={problem} />
      <div className="board-columns">
        {statuses.map((status) => {
          const inColumn = tasks.filter((task) => statusOf(task) === status)
          const headingId = `column-${status}`
          return (
            <section
              key={status}
              data-status={status}
              className={dragging?.over === status ? 'board-column drop-target' : 'board-column'}
              aria-labelledby={headingId}
            >
              <h3 id={headingId}>{t(taskStatusLabel[status])}</h3>
              {inColumn.length === 0 ? <p>{t('noTasks')}</p> : <ul>{inColumn.map((task) => card(task, status))}</ul>}
              {status === 'toDo' &&
                (editing === 'new' ? (
                  <TaskForm label={t('addTask')} assignees={assignees} onSave={(details) => save(() => addTask(groupId, details))} onCancel={() => setEditing(null)} />
                ) : (
                  <button type="button" onClick={() => setEditing('new')}>
                    {t('addTask')}
                  </button>
                ))}
            </section>
          )
        })}
      </div>
    </section>
  )
}
