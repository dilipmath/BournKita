import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchHealth } from './api'

type Status = 'checking' | 'ok' | 'databaseUnavailable' | 'unreachable'

const languages = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
] as const

export default function App() {
  const { t, i18n } = useTranslation()
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    fetchHealth()
      .then((health) => setStatus(health.database === 'ok' ? 'ok' : 'databaseUnavailable'))
      .catch(() => setStatus('unreachable'))
  }, [])

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
      <section>
        <h2>{t('systemStatus')}</h2>
        <p className={`status ${status === 'ok' ? 'status-ok' : status === 'checking' ? '' : 'status-problem'}`} role="status">
          {statusText}
        </p>
      </section>
    </main>
  )
}
