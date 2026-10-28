import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Task, TaskDetails } from './api'

type Props = {
  /** Names the form, e.g. "Add task". */
  label: string
  task?: Task
  onSave: (details: TaskDetails) => Promise<boolean>
  onCancel: () => void
}

/** Adds a Task or changes one, in place on the board. */
export default function TaskForm({ label, task, onSave, onCancel }: Props) {
  const { t } = useTranslation()
  const [details, setDetails] = useState<TaskDetails>(() => ({ title: task?.title ?? '', note: task?.note ?? '' }))
  const [submitting, setSubmitting] = useState(false)

  function field(name: keyof TaskDetails) {
    return {
      value: details[name],
      onChange: (event: { target: { value: string } }) => setDetails({ ...details, [name]: event.target.value }),
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    if (!(await onSave(details))) setSubmitting(false)
  }

  return (
    <form className="contact-form" aria-label={label} onSubmit={(event) => void submit(event)}>
      <label>
        {t('taskTitle')}
        {/* The form opens in place of a button; carry on typing where the tap went. */}
        <input required maxLength={200} autoFocus {...field('title')} />
      </label>
      <label>
        {t('note')}
        <textarea maxLength={2000} {...field('note')} />
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
