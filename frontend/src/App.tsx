import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchCurrentSession, fetchHealth, logOut, type Session } from './api'
import LoginForm from './LoginForm'

type Status = 'checking' | 'ok' | 'databaseUnavailable' | 'unreachable'

const languages = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
] as const

export default function App() {
  const { t, i18n } = useTranslation()
  const [status, setStatus] = useState<Status>('checking')
  // undefined while the session is being checked, null when nobody is logged in.
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    fetchHealth()
      .then((health) => setStatus(health.database === 'ok' ? 'ok' : 'databaseUnavailable'))
      .catch(() => setStatus('unreachable'))
  }, [])

  const checkSession = useCallback(() => {
    fetchCurrentSession()
      .then(setSession)
      .catch(() => setSession(null))
  }, [])

  useEffect(() => {
    checkSession()
    // A tablet woken up after the inactivity timeout must show the login again, not stale data.
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkSession()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [checkSession])

  useEffect(() => {
    if (!session) return
    // Ask again once the session could have timed out. If the server has seen no activity since,
    // the answer is "not logged in" and the login form replaces whatever is on screen.
    const timer = window.setTimeout(checkSession, session.inactivityTimeoutMinutes * 60_000 + 5_000)
    return () => window.clearTimeout(timer)
  }, [session, checkSession])

  const statusText = {
    checking: t('checking'),
    ok: t('allWorking'),
    databaseUnavailable: t('databaseUnavailable'),
    unreachable: t('notReachable'),
  }[status]

  return (
    <main>
      <header>
        <h1>{t('appName')}</h1>
        <nav aria-label={t('language')}>
          {languages.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              lang={code}
              aria-pressed={i18n.language === code}
              onClick={() => void i18n.changeLanguage(code)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      {session === null && <LoginForm onLoggedIn={setSession} />}
      {session && (
        <section className="session">
          <p>{t('loggedInAs', { email: session.email })}</p>
          {/* Even when the server cannot be reached, the logged-in view must not stay on screen. */}
          <button type="button" onClick={() => void logOut().catch(() => undefined).finally(() => setSession(null))}>
            {t('logOut')}
          </button>
        </section>
      )}
      <section>
        <h2>{t('systemStatus')}</h2>
        <p className={`status ${status === 'ok' ? 'status-ok' : status === 'checking' ? '' : 'status-problem'}`} role="status">
          {statusText}
        </p>
      </section>
    </main>
  )
}
