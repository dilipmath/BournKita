import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import AlertMarker from './AlertMarker'
import { fetchGroupDashboard } from './api'
import GroupLabel from './GroupLabel'
import { useRecordAtAddress } from './recordAtAddress'
import RecordPlaceholder from './RecordPlaceholder'

/** The Group dashboard: where a Staff member lands after picking their Group. */
export default function GroupDashboard() {
  const { t } = useTranslation()
  const [loaded] = useRecordAtAddress(fetchGroupDashboard)
  const dashboard = loaded.record
  if (!dashboard) return <RecordPlaceholder {...loaded} backTo={{ to: '/', label: t('backToStart') }} />

  return (
    <section className="page dashboard">
      <h2>
        <GroupLabel group={dashboard} />
      </h2>
      <nav className="actions" aria-label={t('groupViews')}>
        <Link className="button" to={`/groups/${dashboard.id}/board`}>
          {t('taskBoard')}
        </Link>
        <Link className="button" to={`/groups/${dashboard.id}/calendar`}>
          {t('calendar')}
        </Link>
      </nav>
      {dashboard.children.length === 0 ? (
        <p>{t('noChildrenInGroup')}</p>
      ) : (
        <ul className="children-list">
          {dashboard.children.map((child) => (
            <li key={child.id}>
              <Link to={`/children/${child.id}`}>
                {child.firstName} {child.lastName}
              </Link>{' '}
              <AlertMarker label={t('alertsMarker')} alerts={child.alerts} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
