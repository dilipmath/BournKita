import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Contact, ContactDetails } from './api'

type Props = {
  /** Names the form, e.g. "Add emergency contact". */
  label: string
  contact?: Contact
  onSave: (details: Omit<ContactDetails, 'kind'>) => Promise<boolean>
  onCancel: () => void
}

/** Adds a contact or changes one, in place on the profile. */
export default function ContactForm({ label, contact, onSave, onCancel }: Props) {
  const { t } = useTranslation()
  const [details, setDetails] = useState(() => ({
    name: contact?.name ?? '',
    relationship: contact?.relationship ?? '',
    phone: contact?.phone ?? '',
    note: contact?.note ?? '',
  }))
  const [submitting, setSubmitting] = useState(false)

  function field(name: keyof typeof details) {
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
        {t('name')}
        {/* The form opens in place of a button; carry on typing where the tap went. */}
        <input required maxLength={200} autoFocus {...field('name')} />
      </label>
      <label>
        {t('relationship')}
        <input maxLength={100} {...field('relationship')} />
      </label>
      <label>
        {t('phone')}
        <input type="tel" maxLength={50} {...field('phone')} />
      </label>
      <label>
        {t('note')}
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
