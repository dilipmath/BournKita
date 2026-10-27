import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { setMayPickUp, unlinkParent, type ChildProfile } from './api'
import ParentContacts from './ParentContacts'
import ProblemAlert from './ProblemAlert'
import { useProfileChange } from './profileChange'

type Props = { child: ChildProfile; canEdit: boolean; reload: () => void }

/** A Child's Parents with their contact details; Admins link and remove them, and say whether
 * each may pick the Child up. */
export default function ParentsSection({ child, canEdit, reload }: Props) {
  const { t } = useTranslation()
  const { problem, change } = useProfileChange(reload)
  // One change at a time, so a quick second tap cannot race the first.
  const [changing, setChanging] = useState(false)

  async function changeOnce(call: () => Promise<unknown>) {
    setChanging(true)
    await change(call)
    setChanging(false)
  }

  return (
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
            {canEdit ? (
              <>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={parent.mayPickUp}
                    disabled={changing}
                    onChange={(event) => void changeOnce(() => setMayPickUp(child.id, parent.id, event.target.checked))}
                  />
                  {t('mayPickUpNamed', { name: parentName })}
                </label>
                <button type="button" disabled={changing} onClick={() => void changeOnce(() => unlinkParent(child.id, parent.id))}>
                  {t('removeParentNamed', { name: parentName })}
                </button>
              </>
            ) : (
              !parent.mayPickUp && <p>{t('mayNotPickUp')}</p>
            )}
          </article>
        )
      })}
      <ProblemAlert problem={problem} />
      {canEdit && (
        <Link className="button" to={`/children/${child.id}/parents/add`}>
          {t('addParent')}
        </Link>
      )}
    </section>
  )
}
