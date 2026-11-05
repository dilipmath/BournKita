import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { fetchOverview, type KitaOverview } from './api'
import DayHeader, { StartPageSkeleton } from './DayHeader'
import GroupDayTile from './GroupDayTile'

/** An Admin's start page: today at the whole Kita, each Group's day and what needs seeing to. */
export default function KitaOverviewPage({ name }: { name: string }) {
  const { t } = useTranslation()
  const kitaId = useId()
  const [overview, setOverview] = useState<KitaOverview | null | 'failed'>(null)

  useEffect(() => {
    fetchOverview()
      .then(setOverview)
      .catch(() => setOverview('failed'))
  }, [])

  if (overview === 'failed') return <p className="status status-problem">{t('somethingWentWrong')}</p>
  if (overview === null) return <StartPageSkeleton />
  const { kita, groups } = overview
  // All the Groups' Children together; those in no Group are listed below.
  const sum = (part: 'here' | 'gone' | 'absent' | 'notYet') => groups.reduce((total, group) => total + group[part], 0)

  return (
    <section className="page overview">
      <DayHeader name={name} day={overview.day} counts={{ here: sum('here'), gone: sum('gone'), absent: sum('absent'), notYet: sum('notYet') }} />
      {groups.length === 0 ? (
        <div className="empty-state">
          <p>{t('noGroupsYet')}</p>
          <Link className="button primary" to="/groups">
            {t('createFirstGroup')}
          </Link>
        </div>
      ) : (
        <ul className="group-tiles">
          {groups.map((group) => (
            <GroupDayTile key={group.id} group={group} />
          ))}
        </ul>
      )}
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
