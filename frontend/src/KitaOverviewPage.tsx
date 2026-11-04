import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { fetchOverview, type KitaOverview } from './api'
import { longDay } from './calendarDates'
import GroupDayTile from './GroupDayTile'

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
