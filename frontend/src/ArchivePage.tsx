import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { fetchArchive, restoreChild, type ArchivedChild, type ChildSymbol, type Refusal } from './api'
import { fullDate } from './calendarDates'
import { kitaDateTime } from './dates'
import SymbolPicker from './SymbolPicker'

type Restored = { id: number; name: string }

/** The Admin-only archive: deleted Child profiles, kept apart from the current Children until
 * they are purged, each with a button to restore it. */
export default function ArchivePage() {
  const { t, i18n } = useTranslation()
  const [archived, setArchived] = useState<ArchivedChild[]>()
  const [problem, setProblem] = useState<Refusal | 'somethingWentWrong' | null>(null)
  const [restored, setRestored] = useState<Restored | null>(null)
  const [version, setVersion] = useState(0)
  // The Child being restored with another Symbol, theirs having been taken in their Group meanwhile.
  const [choosing, setChoosing] = useState<{ id: number; symbol: ChildSymbol } | null>(null)

  useEffect(() => {
    fetchArchive()
      .then((result) => (typeof result === 'string' ? setProblem(result) : setArchived(result)))
      .catch(() => setProblem('somethingWentWrong'))
  }, [version])

  async function restore(child: ArchivedChild, symbol?: ChildSymbol) {
    setProblem(null)
    setRestored(null)
    try {
      const result = await restoreChild(child.id, symbol)
      if (result === true) {
        setRestored({ id: child.id, name: `${child.firstName} ${child.lastName}` })
        setChoosing(null)
      } else {
        setProblem(result)
        if (result === 'symbolTaken' && choosing?.id !== child.id) setChoosing({ id: child.id, symbol: 'apple' })
      }
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
                {choosing?.id === child.id ? (
                  <>
                    <SymbolPicker value={choosing.symbol} onChange={(symbol) => setChoosing({ id: child.id, symbol })} />
                    <button type="button" className="primary" onClick={() => void restore(child, choosing.symbol)}>
                      {t('restoreWithSymbol', { name })}
                    </button>
                  </>
                ) : (
                  <button type="button" aria-label={t('restoreChild', { name })} onClick={() => void restore(child)}>
                    {t('restore')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
