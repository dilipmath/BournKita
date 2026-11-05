import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router-dom'
import { fetchOwnGroups } from './api'
import GroupLabel from './GroupLabel'
import DayHeader, { StartPageSkeleton } from './DayHeader'
import GroupDayTile from './GroupDayTile'
import { UpdatedNote, useLiveData } from './refresh'
import { useGroups } from './useGroups'

/** Every Group, for a Staff member who works in none yet: they can still open one. */
function AllGroups() {
  const { t } = useTranslation()
  const groups = useGroups()
  return (
    <>
      <p className="status">{t('noOwnGroup')}</p>
      {groups && groups.length > 0 && (
        <ul className="group-tiles">
          {groups.map((group) => (
            <li key={group.id}>
              <Link className="group-tile" to={`/groups/${group.id}`}>
                <strong className="group-tile-name">
                  <GroupLabel group={group} />
                </strong>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** A Teacher's start page, where their day is: their one Group's Today view straight away, a tile
 * for each of their Groups, or every Group while they work in none. */
export default function TeacherStartPage({ name }: { name: string }) {
  const { t } = useTranslation()
  const { data: own, failed, stale, updatedAt } = useLiveData(fetchOwnGroups)

  if (failed) return <p className="status status-problem">{t('somethingWentWrong')}</p>
  if (own === null) return <StartPageSkeleton />
  const { day, groups } = own
  // Replaced, so Back leaves the app rather than coming back here and on again.
  if (groups.length === 1) return <Navigate to={`/groups/${groups[0].id}`} replace />

  return (
    <section className="page overview">
      <DayHeader name={name} day={day} />
      {groups.length > 0 && <UpdatedNote updatedAt={updatedAt} stale={stale} />}
      {groups.length === 0 ? (
        <AllGroups />
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
