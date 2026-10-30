import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { fetchChildren, type ChildSummary } from './api'

/** The list of Children, searchable by name. Admins also get the way to a new profile. */
export default function ChildrenPage({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation()
  // Set after deleting a Child profile, or a Parent's data for good, so the list can say what
  // happened.
  const notice = useLocation().state as { deleted?: string; deletedPermanently?: string } | null
  const [search, setSearch] = useState('')
  const [children, setChildren] = useState<ChildSummary[] | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // Answers to earlier keystrokes may arrive late; only the latest search counts.
    let latest = true
    fetchChildren(search)
      .then((result) => {
        if (!latest) return
        setChildren(result)
        setFailed(false)
      })
      .catch(() => latest && setFailed(true))
    return () => {
      latest = false
    }
  }, [search])

  return (
    <section className="page">
      <h2>{t('children')}</h2>
      {notice?.deleted && (
        <p className="status status-ok" role="status">
          {t('childDeleted', { name: notice.deleted })}
        </p>
      )}
      {notice?.deletedPermanently && (
        <p className="status status-ok" role="status">
          {t('parentDataDeleted', { name: notice.deletedPermanently })}
        </p>
      )}
      {canEdit && (
        <Link className="button primary" to="/children/new">
          {t('newChildProfile')}
        </Link>
      )}
      <label>
        {t('searchByName')}
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      {failed && (
        <p className="status status-problem" role="alert">
          {t('somethingWentWrong')}
        </p>
      )}
      {children === undefined ? (
        !failed && <p>{t('loading')}</p>
      ) : children.length === 0 ? (
        <p>{t('noChildrenFound')}</p>
      ) : (
        <ul className="children-list">
          {children.map((child) => (
            <li key={child.id}>
              <Link to={`/children/${child.id}`}>
                {child.firstName} {child.lastName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
