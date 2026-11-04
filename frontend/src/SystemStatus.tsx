import { useTranslation } from 'react-i18next'

export type ServerStatus = 'checking' | 'ok' | 'databaseUnavailable' | 'unreachable'

const looks: Record<ServerStatus, { text: string; className: string }> = {
  checking: { text: 'checking', className: '' },
  ok: { text: 'allWorking', className: 'status-ok' },
  databaseUnavailable: { text: 'databaseUnavailable', className: 'status-problem' },
  unreachable: { text: 'notReachable', className: 'status-problem' },
}

/** Whether the server and its database answer. */
export default function SystemStatus({ status }: { status: ServerStatus }) {
  const { t } = useTranslation()
  const { text, className } = looks[status]
  return (
    <section>
      <h2>{t('systemStatus')}</h2>
      <p className={`status ${className}`} role="status">
        {t(text)}
      </p>
    </section>
  )
}
