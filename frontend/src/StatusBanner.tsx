import { useTranslation } from 'react-i18next'

export type ServerStatus = 'checking' | 'ok' | 'databaseUnavailable' | 'unreachable'

/** Says so on every page when the server or its database cannot be reached; nothing while they
 * work. */
export default function StatusBanner({ status }: { status: ServerStatus }) {
  const { t } = useTranslation()
  if (status !== 'databaseUnavailable' && status !== 'unreachable') return null
  return (
    <p className="status status-problem status-banner" role="alert">
      {t(status === 'unreachable' ? 'notReachable' : 'databaseUnavailable')}
    </p>
  )
}
