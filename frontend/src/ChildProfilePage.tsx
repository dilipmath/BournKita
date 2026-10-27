import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { deleteChild, fetchChild, genderLabel, unlinkParent, type Refusal } from './api'
import ChildForm from './ChildForm'
import ParentContacts from './ParentContacts'
import { useRecordAtAddress } from './recordAtAddress'
import RecordPlaceholder from './RecordPlaceholder'

type Problem = Refusal | 'somethingWentWrong' | null

/** One Child's profile. Admins can edit and delete it from here. */
export default function ChildProfilePage({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loaded, reload] = useRecordAtAddress(fetchChild)
  const [confirming, setConfirming] = useState(false)
  const [problem, setProblem] = useState<Problem>(null)
  const confirmation = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // The Delete button just disappeared; take keyboard and screen reader users to the question.
    if (confirming) confirmation.current?.focus()
  }, [confirming])

  const child = loaded.record
  if (!child) return <RecordPlaceholder {...loaded} backTo={{ to: '/children', label: t('backToChildren') }} />
  const name = `${child.firstName} ${child.lastName}`

  async function unlink(childId: number, parentId: number) {
    setProblem(null)
    try {
      const result = await unlinkParent(childId, parentId)
      if (result === true) reload()
      else setProblem(result)
    } catch {
      setProblem('somethingWentWrong')
    }
  }

  async function remove(id: number) {
    setProblem(null)
    try {
      const result = await deleteChild(id)
      if (result === true) navigate('/children', { state: { deleted: name } })
      else setProblem(result)
    } catch {
      setProblem('somethingWentWrong')
    }
  }

  return (
    <section className="page profile">
      <Link to="/children">{t('backToChildren')}</Link>
      <h2>{name}</h2>
      <dl>
        <dt>{t('gender')}</dt>
        <dd>{t(child.gender ? genderLabel[child.gender] : 'genderNotStated')}</dd>
        <dt>{t('languagesSpoken')}</dt>
        <dd>{child.languages || '–'}</dd>
        <dt>{t('foodPreferences')}</dt>
        <dd>{child.foodPreferences || '–'}</dd>
        <dt>{t('interests')}</dt>
        <dd>{child.interests || '–'}</dd>
      </dl>
      <section className="parents" aria-labelledby="parents-heading">
        <h3 id="parents-heading">{t('parents')}</h3>
        {child.parents.length === 0 && <p>{t('noParents')}</p>}
        {child.parents.map((parent) => {
          const parentName = `${parent.firstName} ${parent.lastName}`
          return (
            <article key={parent.id} className="parent">
              <h4>
                <Link to={`/parents/${parent.id}`}>{parentName}</Link>
              </h4>
              <ParentContacts parent={parent} />
              {canEdit && (
                <button type="button" onClick={() => void unlink(child.id, parent.id)}>
                  {t('removeParentNamed', { name: parentName })}
                </button>
              )}
            </article>
          )
        })}
        {canEdit && (
          <Link className="button" to={`/children/${child.id}/parents/add`}>
            {t('addParent')}
          </Link>
        )}
      </section>
      {problem && (
        <p className="status status-problem" role="alert">
          {t(problem)}
        </p>
      )}
      {canEdit &&
        (confirming ? (
          // A second, deliberate step: deleting cannot be undone.
          <div className="confirm" role="group" aria-label={t('deleteProfile')} tabIndex={-1} ref={confirmation}>
            <p>{t('confirmDeleteChild', { name })}</p>
            <div className="actions">
              <button type="button" className="danger" onClick={() => void remove(child.id)}>
                {t('deleteProfile')}
              </button>
              <button type="button" onClick={() => setConfirming(false)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="actions">
            <Link className="button primary" to={`/children/${child.id}/edit`}>
              {t('edit')}
            </Link>
            <button type="button" onClick={() => setConfirming(true)}>
              {t('delete')}
            </button>
            <Link className="button" to={`/audit-log?child=${child.id}`}>
              {t('auditLogForChild')}
            </Link>
          </div>
        ))}
    </section>
  )
}

/** The form for changing the Child profile named by the address. Admins only. */
export function ChildEditPage() {
  const [loaded] = useRecordAtAddress(fetchChild)
  // Keyed by ID, so the form starts afresh for another Child.
  return loaded.record ? <ChildForm key={loaded.record.id} child={loaded.record} /> : <RecordPlaceholder {...loaded} />
}
