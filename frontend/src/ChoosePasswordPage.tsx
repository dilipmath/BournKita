import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import type { Refusal } from './api'

type Problem = Refusal | 'passwordsDiffer' | 'somethingWentWrong' | null

type Props = {
  heading: 'choosePassword' | 'chooseNewPassword'
  /** Saves the password with the token from the emailed link; resolves to true once saved. */
  save: (token: string, password: string) => Promise<true | Refusal>
  /** Replaces the default "ask an Admin" message for a used, expired or unknown link. */
  invalidLink?: { message: 'linkNoLongerValid'; help: ReactNode }
}

/** Opened from an emailed link (verification or password reset): the Staff member chooses a
 * password. Needs no login. */
export default function ChoosePasswordPage({ heading, save, invalidLink }: Props) {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [token] = useState(() => searchParams.get('token') ?? '')
  const [password, setPassword] = useState('')
  const [repeated, setRepeated] = useState('')
  const [problem, setProblem] = useState<Problem>(null)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // The token now lives in state; keep it out of the address bar and browser history.
    if (searchParams.has('token')) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== repeated) {
      setProblem('passwordsDiffer')
      return
    }
    setSubmitting(true)
    setProblem(null)
    try {
      const result = await save(token, password)
      if (result === true) setSaved(true)
      else setProblem(result)
    } catch {
      setProblem('somethingWentWrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (saved) {
    return (
      <section className="login">
        <p className="status status-ok" role="status">
          {t('passwordSaved')}
        </p>
        <Link className="button primary" to="/">
          {t('toLogin')}
        </Link>
      </section>
    )
  }

  return (
    <form className="login" onSubmit={(event) => void submit(event)}>
      <h2>{t(heading)}</h2>
      <p id="password-hint">{t('passwordHint')}</p>
      <label>
        {t('newPassword')}
        <input
          type="password"
          autoComplete="new-password"
          aria-describedby="password-hint"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label>
        {t('repeatPassword')}
        <input
          type="password"
          autoComplete="new-password"
          required
          value={repeated}
          onChange={(event) => setRepeated(event.target.value)}
        />
      </label>
      {problem && (
        <p className="status status-problem" role="alert">
          {t(problem === 'invalidLink' && invalidLink ? invalidLink.message : problem)}
        </p>
      )}
      {problem === 'invalidLink' && invalidLink?.help}
      <button type="submit" className="primary" disabled={submitting}>
        {t('savePassword')}
      </button>
    </form>
  )
}
