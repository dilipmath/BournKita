import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { requestPasswordReset } from './api'

/** A Staff member who forgot their password asks for a reset link by email. */
export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setFailed(false)
    try {
      await requestPasswordReset(email)
      setSentTo(email)
    } catch {
      setFailed(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (sentTo !== null) {
    return (
      <section className="login">
        {/* The API answers the same for every address, so this cannot say whether one exists. */}
        <p className="status status-ok" role="status">
          {t('resetLinkOnItsWay', { email: sentTo })}
        </p>
        <Link className="button primary" to="/">
          {t('toLogin')}
        </Link>
      </section>
    )
  }

  return (
    <form className="login" onSubmit={(event) => void submit(event)}>
      <h2>{t('forgotPasswordHeading')}</h2>
      <label>
        {t('emailAddress')}
        <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      {failed && (
        <p className="status status-problem" role="alert">
          {t('somethingWentWrong')}
        </p>
      )}
      <button type="submit" className="primary" disabled={submitting}>
        {t('sendLink')}
      </button>
      <Link to="/">{t('toLogin')}</Link>
    </form>
  )
}
