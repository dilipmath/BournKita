import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteChild, fetchChild, genderLabel, type Child, type Refusal } from './api'
import ChildForm from './ChildForm'

type Problem = Refusal | 'somethingWentWrong' | null

// The Child profile named by the address: undefined while loading, null when there is none.
type LoadedChild = { child: Child | null | undefined; failed: boolean }

function useChild(): LoadedChild {
  const id = Number(useParams().id)
  const [loaded, setLoaded] = useState<LoadedChild>({ child: undefined, failed: false })

  useEffect(() => {
    setLoaded({ child: undefined, failed: false })
    if (!Number.isInteger(id)) {
      setLoaded({ child: null, failed: false })
      return
    }
    // After moving to another Child, a late answer about the previous one must not show.
    let latest = true
    fetchChild(id)
      .then((child) => latest && setLoaded({ child, failed: false }))
      .catch(() => latest && setLoaded({ child: undefined, failed: true }))
    return () => {
      latest = false
    }
  }, [id])

  return loaded
}

/** Stands in for a Child profile that is loading, failed to load or does not exist. */
function ChildPlaceholder({ child, failed }: LoadedChild) {
  const { t } = useTranslation()
  if (failed) {
    return (
      <p className="status status-problem" role="alert">
        {t('somethingWentWrong')}
      </p>
    )
  }
  if (child === null) {
    return (
      <section className="page">
        <p className="status status-problem">{t('notFound')}</p>
        <Link to="/children">{t('backToChildren')}</Link>
      </section>
    )
  }
  return <p>{t('loading')}</p>
}

/** One Child's profile. Admins can edit and delete it from here. */
export default function ChildProfilePage({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const loaded = useChild()
  const [confirming, setConfirming] = useState(false)
  const [problem, setProblem] = useState<Problem>(null)
  const confirmation = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // The Delete button just disappeared; take keyboard and screen reader users to the question.
    if (confirming) confirmation.current?.focus()
  }, [confirming])

  const { child } = loaded
  if (!child) return <ChildPlaceholder {...loaded} />
  const name = `${child.firstName} ${child.lastName}`

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
    <section className="page child-profile">
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
          </div>
        ))}
    </section>
  )
}

/** The form for changing the Child profile named by the address. Admins only. */
export function ChildEditPage() {
  const loaded = useChild()
  // Keyed by ID, so the form starts afresh for another Child.
  return loaded.child ? <ChildForm key={loaded.child.id} child={loaded.child} /> : <ChildPlaceholder {...loaded} />
}
