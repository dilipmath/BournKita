import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { linkParent, searchParents, type ParentSummary, type Refusal } from './api'
import ParentForm from './ParentForm'

/** Adds a Parent to a Child: one already recorded (e.g. for a Sibling), or a new one. Admins only. */
export default function AddParentPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const childId = Number(useParams().id)
  const [search, setSearch] = useState('')
  const [found, setFound] = useState<ParentSummary[]>([])
  const [problem, setProblem] = useState<Refusal | 'somethingWentWrong' | null>(null)

  useEffect(() => {
    // Answers to earlier keystrokes may arrive late; only the latest search counts.
    let latest = true
    searchParents(search)
      .then((result) => latest && setFound(result))
      .catch(() => latest && setProblem('somethingWentWrong'))
    return () => {
      latest = false
    }
  }, [search])

  async function link(parentId: number) {
    setProblem(null)
    try {
      const result = await linkParent(childId, parentId)
      if (result === true) navigate(`/children/${childId}`)
      else setProblem(result)
    } catch {
      setProblem('somethingWentWrong')
    }
  }

  return (
    <>
      <section className="page">
        <Link to={`/children/${childId}`}>{t('backToProfile')}</Link>
        <h2>{t('addParent')}</h2>
        {problem && (
          <p className="status status-problem" role="alert">
            {t(problem)}
          </p>
        )}
        <label>
          {t('findRecordedParent')}
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        {search.trim() && (
          <ul className="children-list">
            {found.map((parent) => {
              const name = `${parent.firstName} ${parent.lastName}`
              return (
                <li key={parent.id} className="found-parent">
                  <span>{name}</span>
                  <button type="button" aria-label={t('linkParentNamed', { name })} onClick={() => void link(parent.id)}>
                    {t('link')}
                  </button>
                </li>
              )
            })}
            {found.length === 0 && <li>{t('noParentsFound')}</li>}
          </ul>
        )}
      </section>
      <ParentForm heading="newParent" submitLabel="saveAndLink" onSaved={(parent) => link(parent.id)} />
    </>
  )
}
