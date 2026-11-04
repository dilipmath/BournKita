import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { fetchOverview, type GroupDay, type KitaOverview } from './api'
import { longDay } from './calendarDates'
import GroupLabel from './GroupLabel'

/** A Group's tile: its day in numbers; a tap opens its Today view. Shared with the Teachers'
 * start page. */
export function GroupDayTile({ group }: { group: GroupDay }) {
  const { t } = useTranslation()
  const fullName = (child: { firstName: string; lastName: string }) => `${child.firstName} ${child.lastName}`
  return (
    <li>
      <Link className="group-tile" to={`/groups/${group.id}`}>
        <strong className="group-tile-name">
          <GroupLabel group={group} />
        </strong>
        {group.expected === 0 ? (
          <span>{t('noChildrenInGroup')}</span>
        ) : (
          <>
            <span>{t('todayCounts', { here: group.here, gone: group.gone, absent: group.absent, notYet: group.notYet })}</span>
            {group.alertsHere > 0 && (
              <span className="group-tile-alerts">
                <span aria-hidden="true">⚠ </span>
                {t('withAlertsHere', { count: group.alertsHere })}
              </span>
            )}
          </>
        )}
        {group.birthdays.length > 0 && (
          <span>
            <span aria-hidden="true">🎂 </span>
            {t('birthdayToday', { names: group.birthdays.map(fullName).join(', ') })}
          </span>
        )}
      </Link>
    </li>
  )
}

/** An Admin's start page: today at the whole Kita, each Group's day and what needs seeing to. */
export default function KitaOverviewPage() {
  const { t, i18n } = useTranslation()
  const kitaId = useId()
  const [overview, setOverview] = useState<KitaOverview | null | 'failed'>(null)

  useEffect(() => {
    fetchOverview()
      .then(setOverview)
      .catch(() => setOverview('failed'))
  }, [])

  if (overview === 'failed') return <p className="status status-problem">{t('somethingWentWrong')}</p>
  if (overview === null) return <p>{t('loading')}</p>
  const { kita } = overview

  return (
    <section className="page overview">
      <h2>{t('todayAtKita', { day: longDay(overview.day, i18n.language) })}</h2>
      <ul className="group-tiles">
        {overview.groups.map((group) => (
          <GroupDayTile key={group.id} group={group} />
        ))}
      </ul>
      <section className="kita-today" aria-labelledby={kitaId}>
        <h3 id={kitaId}>{t('overviewWholeKita')}</h3>
        <p>{t('stillCheckedIn', { count: kita.stillCheckedIn })}</p>
        {kita.withoutGroup.length === 0 ? (
          <p>{t('everyChildInGroup')}</p>
        ) : (
          <p>
            {t('inNoGroup')}{' '}
            {kita.withoutGroup.map((child, index) => (
              <span key={child.id}>
                {index > 0 && ', '}
                <Link to={`/children/${child.id}`}>
                  {child.firstName} {child.lastName}
                </Link>
              </span>
            ))}
          </p>
        )}
        <p>
          <Link to="/incidents">{t('incidentsToday', { count: kita.incidentsToday })}</Link>
        </p>
      </section>
    </section>
  )
}
