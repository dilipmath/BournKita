import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { saveParent, type Parent, type ParentDetails, type Refusal } from './api'

type Problem = Refusal | 'somethingWentWrong' | null

const empty: ParentDetails = { firstName: '', lastName: '', address: '', phone: '', email: '' }

type Props = {
  /** The Parent to edit; without one, the form records a new Parent. */
  parent?: Parent
  heading: 'newParent' | 'editParent'
  submitLabel: 'save' | 'saveAndLink'
  onSaved: (parent: Parent) => Promise<void> | void
}

/** Records a new Parent or edits one. Admins only. */
export default function ParentForm({ parent, heading, submitLabel, onSaved }: Props) {
  const { t } = useTranslation()
  const [details, setDetails] = useState<ParentDetails>(() => {
    if (!parent) return empty
    const { firstName, lastName, address, phone, email } = parent
    return { firstName, lastName, address, phone, email }
  })
  const [problem, setProblem] = useState<Problem>(null)
  const [submitting, setSubmitting] = useState(false)

  function field(name: keyof ParentDetails) {
    return {
      value: details[name],
      onChange: (event: { target: { value: string } }) => setDetails({ ...details, [name]: event.target.value }),
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setProblem(null)
    try {
      const result = await saveParent(details, parent?.id)
      if (typeof result === 'string') setProblem(result)
      else await onSaved(result)
    } catch {
      setProblem('somethingWentWrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="page" aria-label={t(heading)} onSubmit={(event) => void submit(event)}>
      <h2>{t(heading)}</h2>
      <label>
        {t('firstName')}
        <input required maxLength={100} {...field('firstName')} />
      </label>
      <label>
        {t('lastName')}
        <input required maxLength={100} {...field('lastName')} />
      </label>
      <label>
        {t('address')}
        <textarea maxLength={500} {...field('address')} />
      </label>
      <label>
        {t('phone')}
        <input type="tel" maxLength={50} {...field('phone')} />
      </label>
      <label>
        {t('emailAddress')}
        <input type="email" maxLength={320} {...field('email')} />
      </label>
      {problem && (
        <p className="status status-problem" role="alert">
          {t(problem)}
        </p>
      )}
      <button type="submit" className="primary" disabled={submitting}>
        {t(submitLabel)}
      </button>
    </form>
  )
}
