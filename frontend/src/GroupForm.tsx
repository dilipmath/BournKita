import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { groupIcons, type GroupDetails, type GroupIcon } from './api'

type Props = {
  /** Names the form, e.g. "New Group". */
  label: string
  submitLabel: string
  group?: GroupDetails
  onSave: (details: GroupDetails) => Promise<boolean>
  onCancel?: () => void
}

/** A Group's name and icon, for a new Group or a change; Admins only. */
export default function GroupForm({ label, submitLabel, group, onSave, onCancel }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState(group?.name ?? '')
  const [icon, setIcon] = useState<GroupIcon>(group?.icon ?? 'monkey')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    const saved = await onSave({ name, icon })
    setSubmitting(false)
    // A new Group's form stays, empty, for the next one.
    if (saved && !group) setName('')
  }

  return (
    <form className="group-form" aria-label={label} onSubmit={(event) => void submit(event)}>
      <label>
        {t('name')}
        <input required maxLength={50} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <fieldset className="icons">
        <legend>{t('icon')}</legend>
        {(Object.keys(groupIcons) as GroupIcon[]).map((option) => (
          <label key={option}>
            <input type="radio" name="icon" value={option} checked={icon === option} onChange={() => setIcon(option)} />
            <span aria-hidden="true">{groupIcons[option]}</span>
            <span className="visually-hidden">{t(`icon_${option}`)}</span>
          </label>
        ))}
      </fieldset>
      <div className="actions">
        <button type="submit" className="primary" disabled={submitting}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            {t('cancel')}
          </button>
        )}
      </div>
    </form>
  )
}
