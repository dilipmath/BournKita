import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { alertKindLabel, type Alert, type AlertDetails, type AlertKind } from './api'

type Props = {
  /** Names the form, e.g. "Add allergy or medical condition". */
  label: string
  alert?: Alert
  onSave: (details: AlertDetails) => Promise<boolean>
  onCancel: () => void
}

/** Adds an alert or changes one, in place in the banner. */
export default function AlertForm({ label, alert, onSave, onCancel }: Props) {
  const { t } = useTranslation()
  const [details, setDetails] = useState<AlertDetails>(() => ({
    kind: alert?.kind ?? 'allergy',
    name: alert?.name ?? '',
    note: alert?.note ?? '',
  }))
  const [submitting, setSubmitting] = useState(false)

  function field(name: keyof AlertDetails) {
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
        {t('alertKind')}
        <select {...field('kind')}>
          {(Object.keys(alertKindLabel) as AlertKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {t(alertKindLabel[kind])}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('alertName')}
        {/* The form opens in place of a button; carry on typing where the tap went. */}
        <input required maxLength={200} autoFocus {...field('name')} />
      </label>
      <label>
        {t('alertNote')}
        <textarea maxLength={1000} {...field('note')} />
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
