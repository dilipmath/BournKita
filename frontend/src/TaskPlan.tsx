import { useTranslation } from 'react-i18next'
import type { Task } from './api'
import { kitaToday, localDate } from './dates'
import Icon from './Icon'

/** Who does a Task, when it is due (and whether that has passed) and its labels; nothing when
 * none of these is set. */
export default function TaskPlan({ task }: { task: Task }) {
  const { t, i18n } = useTranslation()
  if (!task.assignee && !task.dueOn && task.labels.length === 0) return null
  // Dates as a date field gives them compare as text.
  const overdue = task.dueOn !== null && task.status !== 'done' && task.dueOn < kitaToday()
  return (
    <div className="task-plan">
      {task.assignee && (
        <span>
          <Icon name="person" />
          <span className="visually-hidden">{t('taskAssignee')}: </span>
          {task.assignee.email}
        </span>
      )}
      {task.dueOn && (
        <span className={overdue ? 'overdue' : undefined}>
          <Icon name="calendar" />
          <span className="visually-hidden">{t('taskDueOn')}: </span>
          {localDate(task.dueOn).toLocaleDateString(i18n.language)}
          {overdue && ` – ${t('overdue')}`}
        </span>
      )}
      {task.labels.length > 0 && (
        <span className="labels">
          <span className="visually-hidden">{t('taskLabelsList')}: </span>
          {task.labels.map((label) => (
            <span key={label} className="label">
              {label}
            </span>
          ))}
        </span>
      )}
    </div>
  )
}
