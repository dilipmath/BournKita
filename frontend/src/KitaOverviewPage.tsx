import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { fetchOverview } from './api'
import { dayOfGroups } from './dayCounts'
import DayHeader, { StartPageSkeleton } from './DayHeader'
import GroupDayTile from './GroupDayTile'
import NeedsAttention from './NeedsAttention'
import SummaryStrip from './SummaryStrip'
import { useLiveData } from './refresh'
import UpdatedNote from './UpdatedNote'

/** An Admin's start page: today at the whole Kita, what needs seeing to, and each Group's day;
 * kept fresh on a tablet left on the wall. */
export default function KitaOverviewPage({ name }: { name: string }) {
  const { t } = useTranslation()
  const { data: overview, failed, stale, updatedAt } = useLiveData(fetchOverview)

  if (failed) return <p className="status status-problem">{t('somethingWentWrong')}</p>
  if (overview === null) return <StartPageSkeleton />
  const { groups, kita } = overview

  return (
    <section className="page overview">
      <DayHeader name={name} day={overview.day} />
      {/* All the Groups' Children together; those in no Group, and Birthdays, are under Needs attention. */}
      <SummaryStrip day={dayOfGroups(groups)} />
      <UpdatedNote updatedAt={updatedAt} stale={stale} />
      <NeedsAttention
        closesAt={kita.closesAt}
        late={kita.stillHereAfterClosing}
        birthdays={groups.flatMap((group) => group.birthdays)}
        withoutGroup={kita.withoutGroup}
        incidentsToday={kita.incidentsToday}
      />
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
    </section>
  )
}
