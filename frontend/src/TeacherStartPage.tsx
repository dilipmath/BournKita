import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router-dom'
import { fetchOwnGroups, type GroupDay } from './api'
import GroupLabel from './GroupLabel'
import GroupDayTile from './GroupDayTile'
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
export default function TeacherStartPage() {
  const { t } = useTranslation()
  const [own, setOwn] = useState<GroupDay[] | null | 'failed'>(null)

  useEffect(() => {
    fetchOwnGroups()
      .then(setOwn)
      .catch(() => setOwn('failed'))
  }, [])

  if (own === 'failed') return <p className="status status-problem">{t('somethingWentWrong')}</p>
  if (own === null) return <p>{t('loading')}</p>
  // Replaced, so Back leaves the app rather than coming back here and on again.
  if (own.length === 1) return <Navigate to={`/groups/${own[0].id}`} replace />

  return (
    <section className="page overview">
      <h2>{t('myGroups')}</h2>
      {own.length === 0 ? (
        <AllGroups />
      ) : (
        <ul className="group-tiles">
          {own.map((group) => (
            <GroupDayTile key={group.id} group={group} />
          ))}
        </ul>
      )}
    </section>
  )
}
