import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { fetchArchive, restoreChild, type ArchivedChild, type Refusal } from './api'
import { fullDate } from './calendarDates'
import { kitaDateTime } from './dates'

type Restored = { id: number; name: string }

/** The Admin-only archive: deleted Child profiles, kept apart from the current Children until
 * they are purged, each with a button to restore it. */
export default function ArchivePage() {
  const { t, i18n } = useTranslation()
  const [archived, setArchived] = useState<ArchivedChild[]>()
  const [problem, setProblem] = useState<Refusal | 'somethingWentWrong' | null>(null)
  const [restored, setRestored] = useState<Restored | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    fetchArchive()
      .then((result) => (typeof result === 'string' ? setProblem(result) : setArchived(result)))
      .catch(() => setProblem('somethingWentWrong'))
  }, [version])

  async function restore(child: ArchivedChild) {
    setProblem(null)
    setRestored(null)
    try {
      const result = await restoreChild(child.id)
      if (result === true) setRestored({ id: child.id, name: `${child.firstName} ${child.lastName}` })
      else setProblem(result)
    } catch {
      setProblem('somethingWentWrong')
    }
    setVersion((current) => current + 1)
  }

  return (
    <section className="page archive">
      <h2>{t('archive')}</h2>
      <p>{t('archiveExplained')}</p>
      {restored && (
        <p className="status status-ok" role="status">
          {t('childRestored', { name: restored.name })} <Link to={`/children/${restored.id}`}>{restored.name}</Link>
        </p>
      )}
      {problem && (
        <p className="status status-problem" role="alert">
          {t(problem)}
        </p>
      )}
      {archived?.length === 0 && <p>{t('archiveEmpty')}</p>}
      {archived && archived.length > 0 && (
        <ul className="archived-children">
          {archived.map((child) => {
            const name = `${child.firstName} ${child.lastName}`
            return (
              <li key={child.id}>
                <strong>{name}</strong>
                <span>
                  {t('archivedChild', {
                    deleted: kitaDateTime(child.archivedAt, i18n.language),
                    purged: fullDate(child.purgeOn, i18n.language),
                  })}
                </span>
                <button type="button" aria-label={t('restoreChild', { name })} onClick={() => void restore(child)}>
                  {t('restore')}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
