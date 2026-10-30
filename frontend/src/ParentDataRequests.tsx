import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { deleteParentData, parentExportUrl, type ParentWithChildren } from './api'
import ProblemAlert from './ProblemAlert'
import type { Problem } from './profileChange'

/** An Admin's answers to a Parent's data-subject requests: export everything held about them
 * and their Children, or delete it for good. */
export default function ParentDataRequests({ parent }: { parent: ParentWithChildren }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [problem, setProblem] = useState<Problem>(null)
  const confirmation = useRef<HTMLDivElement>(null)
  const name = `${parent.firstName} ${parent.lastName}`
  const children = parent.children.map((child) => `${child.firstName} ${child.lastName}`).join(', ')

  useEffect(() => {
    // The Delete button just disappeared; take keyboard and screen reader users to the question.
    if (confirming) confirmation.current?.focus()
  }, [confirming])

  async function remove() {
    setProblem(null)
    try {
      const result = await deleteParentData(parent.id)
      if (result === true) navigate('/children', { state: { deletedPermanently: name } })
      else setProblem(result)
    } catch {
      setProblem('somethingWentWrong')
    }
  }

  return (
    <>
      <ProblemAlert problem={problem} />
      {confirming ? (
        // A second, deliberate step: this one cannot be undone.
        <div className="confirm" role="group" aria-label={t('deleteAllData')} tabIndex={-1} ref={confirmation}>
          <p>{t('confirmDeleteParentData', { name, children: children || '–' })}</p>
          <div className="actions">
            <button type="button" className="danger" onClick={() => void remove()}>
              {t('deletePermanently')}
            </button>
            <button type="button" onClick={() => setConfirming(false)}>
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          {/* Downloaded with the Admin's session; the ZIP's name comes from the API. */}
          <a className="button" href={parentExportUrl(parent.id)} download>
            {t('exportAllData')}
          </a>
          <button type="button" onClick={() => setConfirming(true)}>
            {t('deleteAllData')}
          </button>
        </div>
      )}
    </>
  )
}
