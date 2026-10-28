import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Assignee, Task, TaskDetails } from './api'

type Props = {
  /** Names the form, e.g. "Add task". */
  label: string
  task?: Task
  /** Whom the Task can be given to: the Group's Staff members; undefined while loading. */
  assignees: Assignee[] | undefined
  onSave: (details: TaskDetails) => Promise<boolean>
  onCancel: () => void
}

/** "Laundry, Art" as the labels it names. */
function parseLabels(text: string): string[] {
  return text
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
}

/** Adds a Task or changes one, in place on the board. */
export default function TaskForm({ label, task, assignees, onSave, onCancel }: Props) {
  const { t } = useTranslation()
  const assigneeId = useId()
  const [title, setTitle] = useState(task?.title ?? '')
  const [note, setNote] = useState(task?.note ?? '')
  const [assignee, setAssignee] = useState(task?.assignee ? String(task.assignee.id) : '')
  const [dueOn, setDueOn] = useState(task?.dueOn ?? '')
  const [labels, setLabels] = useState(task?.labels.join(', ') ?? '')
  const [submitting, setSubmitting] = useState(false)
  // Someone who no longer works in the Group stays assigned until the form changes it.
  const choices = assignees && task?.assignee && !assignees.some((a) => a.id === task.assignee?.id) ? [...assignees, task.assignee] : assignees

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    const details = { title, note, assigneeId: assignee ? Number(assignee) : null, dueOn: dueOn || null, labels: parseLabels(labels) }
    if (!(await onSave(details))) setSubmitting(false)
  }

  return (
    <form className="contact-form" aria-label={label} onSubmit={(event) => void submit(event)}>
      <label>
        {t('taskTitle')}
        {/* The form opens in place of a button; carry on typing where the tap went. */}
        <input required maxLength={200} autoFocus value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        {t('note')}
        <textarea maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {/* Beside the drop-down, not around it, so the picked option does not join its name. */}
      <label htmlFor={assigneeId}>{t('taskAssignee')}</label>
      <select id={assigneeId} value={assignee} disabled={choices === undefined} onChange={(event) => setAssignee(event.target.value)}>
        <option value="">{t('nobodyYet')}</option>
        {choices?.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.email}
          </option>
        ))}
      </select>
      <label>
        {t('taskDueOn')}
        <input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
      </label>
      <label>
        {t('taskLabels')}
        <input value={labels} onChange={(event) => setLabels(event.target.value)} />
      </label>
      <div className="actions">
        <button type="submit" className="primary" disabled={submitting}>
          {t('save')}
        </button>
        <button type="button" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
