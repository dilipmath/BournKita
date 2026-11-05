import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { fetchOverview } from './api'
import DayHeader, { StartPageSkeleton } from './DayHeader'
import GroupDayTile from './GroupDayTile'
import NeedsAttention from './NeedsAttention'
import { UpdatedNote, useLiveData } from './refresh'

/** An Admin's start page: today at the whole Kita, what needs seeing to, and each Group's day;
 * kept fresh on a tablet left on the wall. */
export default function KitaOverviewPage({ name }: { name: string }) {
  const { t } = useTranslation()
  const { data: overview, failed, stale, updatedAt } = useLiveData(fetchOverview)

  if (failed) return <p className="status status-problem">{t('somethingWentWrong')}</p>
  if (overview === null) return <StartPageSkeleton />
  const { groups } = overview
  // All the Groups' Children together; those in no Group are under Needs attention.
  const sum = (part: 'here' | 'gone' | 'absent' | 'notYet') => groups.reduce((total, group) => total + group[part], 0)

  return (
    <section className="page overview">
      <DayHeader name={name} day={overview.day} counts={{ here: sum('here'), gone: sum('gone'), absent: sum('absent'), notYet: sum('notYet') }} />
      <UpdatedNote updatedAt={updatedAt} stale={stale} />
      <NeedsAttention overview={overview} />
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
