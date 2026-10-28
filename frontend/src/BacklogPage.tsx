import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { fetchTasks, reorderBacklog, type Task } from './api'
import GroupLabel from './GroupLabel'
import ProblemAlert from './ProblemAlert'
import type { Problem } from './profileChange'
import { useRecordAtAddress } from './recordAtAddress'
import RecordPlaceholder from './RecordPlaceholder'
import TaskPlan from './TaskPlan'
import { useGroups } from './useGroups'
import { dataAt, usePointerDrag } from './usePointerDrag'

/** `ids` with `id` moved to where `target` is. */
function moved(ids: number[], id: number, target: number): number[] {
  const without = ids.filter((other) => other !== id)
  without.splice(ids.indexOf(target), 0, id)
  return without
}

/** The Backlog item under a point, by Task ID, other than the one being dragged. */
function itemAt(x: number, y: number, dragged: number): number | null {
  const id = dataAt(x, y, 'taskId', String(dragged))
  return id === null ? null : Number(id)
}

/** A Group's Backlog: its To do Tasks, most important first. Staff put them in order by
 * dragging (by touch too) or with the Move up and Move down buttons. */
export default function BacklogPage() {
  const { t } = useTranslation()
  const groupId = Number(useParams().id)
  const [loaded, reload] = useRecordAtAddress(fetchTasks)
  const group = useGroups()?.find((listed) => listed.id === groupId)
  const [problem, setProblem] = useState<Problem>(null)
  // An order shown until the Backlog reloads; it applies only to the one loaded when made.
  const [shownOrder, setShownOrder] = useState<{ on: Task[]; ids: number[] } | null>(null)
  const { handleProps, dragging } = usePointerDrag(itemAt, (taskId, over) => void reorder(moved(ids, taskId, over)))

  const tasks = loaded.record
  if (!tasks) return <RecordPlaceholder {...loaded} backTo={{ to: '/', label: t('backToStart') }} />
  const backlogTasks = tasks.filter((task) => task.status === 'toDo')
  const ids = shownOrder?.on === tasks ? shownOrder.ids : backlogTasks.map((task) => task.id)
  const backlog = ids.map((id) => backlogTasks.find((task) => task.id === id)).filter((task) => task !== undefined)

  async function reorder(order: number[]) {
    if (!tasks) return
    setProblem(null)
    setShownOrder({ on: tasks, ids: order })
    try {
      const result = await reorderBacklog(groupId, order)
      // Changed meanwhile: show it as it is now, to be put in order again.
      if (result !== true) setProblem(result)
    } catch {
      setProblem('somethingWentWrong')
    }
    reload()
  }

  return (
    <section className="page backlog">
      <nav className="actions" aria-label={t('taskViews')}>
        <Link to={`/groups/${groupId}/board`}>{t('backToTaskBoard')}</Link>
      </nav>
      <h2>
        {t('backlog')}
        {group && (
          <>
            {': '}
            <GroupLabel group={group} />
          </>
        )}
      </h2>
      <p>{t('backlogExplained')}</p>
      <ProblemAlert problem={problem} />
      {backlog.length === 0 ? (
        <p>{t('noTasks')}</p>
      ) : (
        <ol className="backlog-list" aria-label={t('backlog')}>
          {backlog.map((task, index) => {
            const isDragged = dragging?.id === task.id
            const classes = ['task', isDragged && 'dragging', dragging?.over === task.id && 'drop-target'].filter(Boolean)
            return (
              <li
                key={task.id}
                data-task-id={task.id}
                className={classes.join(' ')}
                style={isDragged ? { transform: `translateY(${dragging.dy}px)` } : undefined}
              >
                <div className="task-title">
                  {/* For pointers only: keyboards and screen readers use the Move buttons. */}
                  <span className="drag-handle" aria-hidden="true" {...handleProps(task.id)}>
                    ⠿
                  </span>
                  <span className="rank">#{index + 1}</span>
                  <strong>{task.title}</strong>
                </div>
                <TaskPlan task={task} />
                <div className="actions">
                  {index > 0 && (
                    <button
                      type="button"
                      aria-label={t('moveNamedUp', { name: task.title })}
                      onClick={() => void reorder(moved(ids, task.id, ids[index - 1]))}
                    >
                      ↑ {t('moveUp')}
                    </button>
                  )}
                  {index < backlog.length - 1 && (
                    <button
                      type="button"
                      aria-label={t('moveNamedDown', { name: task.title })}
                      onClick={() => void reorder(moved(ids, task.id, ids[index + 1]))}
                    >
                      ↓ {t('moveDown')}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
