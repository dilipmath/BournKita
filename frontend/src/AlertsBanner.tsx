import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addAlert, alertKindLabel, removeAlert, updateAlert, type Alert } from './api'
import AlertForm from './AlertForm'
import ProblemAlert from './ProblemAlert'
import { useProfileChange } from './profileChange'

type Props = { childId: number; alerts: Alert[]; canEdit: boolean; reload: () => void }

/** The prominent banner at the top of a Child profile, with the Child's allergies and medical
 * conditions; Admins add, change and remove them here. */
export default function AlertsBanner({ childId, alerts, canEdit, reload }: Props) {
  const { t } = useTranslation()
  const { problem, change } = useProfileChange(reload)
  // The alert being changed, or 'new' while one is added.
  const [editing, setEditing] = useState<number | 'new' | null>(null)

  async function save(call: () => Promise<unknown>) {
    const saved = await change(call)
    if (saved) setEditing(null)
    return saved
  }

  return (
    <section className={alerts.length ? 'alert-banner' : 'alert-banner none'} aria-labelledby="alerts-heading">
      <h3 id="alerts-heading">
        {alerts.length > 0 && <span aria-hidden="true">⚠ </span>}
        {t('alerts')}
      </h3>
      {alerts.length === 0 ? (
        <p>{t('noAlerts')}</p>
      ) : (
        <ul>
          {alerts.map((alert) =>
            editing === alert.id ? (
              <li key={alert.id}>
                <AlertForm
                  label={t('changeNamed', { name: alert.name })}
                  alert={alert}
                  onSave={(details) => save(() => updateAlert(childId, alert.id, details))}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={alert.id}>
                <span className="alert-kind">{t(alertKindLabel[alert.kind])}: </span>
                <strong>{alert.name}</strong>
                {alert.note && <p className="note">{alert.note}</p>}
                {canEdit && (
                  <div className="actions">
                    <button type="button" onClick={() => setEditing(alert.id)}>
                      {t('changeNamed', { name: alert.name })}
                    </button>
                    <button type="button" onClick={() => void change(() => removeAlert(childId, alert.id))}>
                      {t('removeNamed', { name: alert.name })}
                    </button>
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}
      <ProblemAlert problem={problem} />
      {canEdit &&
        (editing === 'new' ? (
          <AlertForm label={t('addAlert')} onSave={(details) => save(() => addAlert(childId, details))} onCancel={() => setEditing(null)} />
        ) : (
          <button type="button" onClick={() => setEditing('new')}>
            {t('addAlert')}
          </button>
        ))}
    </section>
  )
}
