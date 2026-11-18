import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { logIn, type Refusal, type Session } from './api'

type Problem = Refusal | 'loginUnavailable' | null

type Props = { id?: string; greeting?: ReactNode; onLoggedIn: (session: Session) => void }

/** The login card; a greeting, when given, opens it. */
export default function LoginForm({ id, greeting, onLoggedIn }: Props) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [problem, setProblem] = useState<Problem>(null)
  const [submitting, setSubmitting] = useState(false)
  const headingId = useId()
  const passwordId = useId()
  const [showPassword, setShowPassword] = useState(false)
  const message = useRef<HTMLDivElement>(null)

  // A refusal is read out and the keyboard is there to act on it.
  useEffect(() => {
    if (problem) message.current?.focus()
  }, [problem])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setProblem(null)
    // Not left readable for whoever takes the tablet next.
    setShowPassword(false)
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
    <form id={id} className="login" aria-labelledby={headingId} onSubmit={(event) => void submit(event)}>
      {greeting}
      <h3 id={headingId}>{t('logIn')}</h3>
      <label>
        {t('emailAddress')}
        <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <div className="password-field">
        <label htmlFor={passwordId}>{t('password')}</label>
        <div>
          <input
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
            {t(showPassword ? 'hidePassword' : 'showPassword')}
          </button>
        </div>
      </div>
      {/* Focused when it appears, which reads it out once; a live role as well would read it twice. */}
      {problem && (
        <div ref={message} tabIndex={-1} className="login-problem">
          <p className="status status-problem">{t(problem)}</p>
          {/* The API answers a locked account like a wrong password, so always explain both. */}
          {problem === 'invalidCredentials' && <p>{t('lockoutHint')}</p>}
        </div>
      )}
      <button type="submit" className="primary" disabled={submitting} aria-busy={submitting}>
        {t(submitting ? 'loggingIn' : 'logIn')}
      </button>
      <Link to="/forgot-password">{t('forgotPasswordLink')}</Link>
    </form>
  )
}
