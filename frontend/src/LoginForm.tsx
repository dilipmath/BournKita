import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { logIn, type Refusal, type Session } from './api'

type Problem = Refusal | 'loginUnavailable' | null

export default function LoginForm({ onLoggedIn }: { onLoggedIn: (session: Session) => void }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [problem, setProblem] = useState<Problem>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setProblem(null)
    try {
      const result = await logIn(email, password)
      if (typeof result === 'string') {
        setProblem(result)
        setPassword('')
      } else {
        onLoggedIn(result)
      }
    } catch {
      setProblem('loginUnavailable')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="login" onSubmit={(event) => void submit(event)}>
      <h2>{t('logIn')}</h2>
      <label>
        {t('emailAddress')}
        <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        {t('password')}
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {problem && (
        <p className="status status-problem" role="alert">
          {t(problem)}
        </p>
      )}
      {/* The API answers a locked account like a wrong password, so always explain both. */}
      {problem === 'invalidCredentials' && <p>{t('lockoutHint')}</p>}
      <button type="submit" className="primary" disabled={submitting}>
        {t('logIn')}
      </button>
      <Link to="/forgot-password">{t('forgotPasswordLink')}</Link>
    </form>
  )
}
