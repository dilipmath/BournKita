import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import AlertMarker from './AlertMarker'
import AlertsBanner from './AlertsBanner'
import { fullDate } from './calendarDates'
import { childPhotoUrl, deleteChild, fetchChild, genderLabel } from './api'
import ChildForm from './ChildForm'
import ChildGroup from './ChildGroup'
import ConsentsSection from './ConsentsSection'
import ContactsSection from './ContactsSection'
import GallerySection from './GallerySection'
import ParentsSection from './ParentsSection'
import ProblemAlert from './ProblemAlert'
import type { Problem } from './profileChange'
import { useRecordAtAddress } from './recordAtAddress'
import RecordPlaceholder from './RecordPlaceholder'

/** One Child's profile. Admins can edit and delete it from here. */
export default function ChildProfilePage({ canEdit }: { canEdit: boolean }) {
  const { t, i18n } = useTranslation()
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
      <div className="profile-heading">
        {/* The newest photo; none without photo Consent. */}
        {child.photos[0] && <img src={childPhotoUrl(child.id, child.photos[0].id, 'thumbnail')} alt={t('photoOf', { name })} />}
        <h2>{name}</h2>
      </div>
      <AlertsBanner childId={child.id} alerts={child.alerts} canEdit={canEdit} reload={reload} />
      <dl>
        <ChildGroup child={child} canEdit={canEdit} reload={reload} />
        <dt>{t('gender')}</dt>
        <dd>{t(child.gender ? genderLabel[child.gender] : 'genderNotStated')}</dd>
        <dt>{t('dateOfBirth')}</dt>
        <dd>{child.dateOfBirth ? fullDate(child.dateOfBirth, i18n.language) : '–'}</dd>
        <dt>{t('languagesSpoken')}</dt>
        <dd>{child.languages || '–'}</dd>
        <dt>{t('foodPreferences')}</dt>
        <dd>
          {child.foodPreferences || '–'}{' '}
          {/* So nobody serves the Child something dangerous. */}
          <AlertMarker label={t('allergies')} alerts={child.alerts.filter((alert) => alert.kind === 'allergy')} />
        </dd>
        <dt>{t('interests')}</dt>
        <dd>{child.interests || '–'}</dd>
      </dl>
      <ContactsSection
        kind="pickUp"
        childId={child.id}
        contacts={child.pickUpPersons}
        parents={child.parents}
        canEdit={canEdit}
        reload={reload}
      />
      <ContactsSection kind="emergency" childId={child.id} contacts={child.emergencyContacts} canEdit={canEdit} reload={reload} />
      <ParentsSection child={child} canEdit={canEdit} reload={reload} />
      <ConsentsSection childId={child.id} consents={child.consents} canEdit={canEdit} reload={reload} />
      <GallerySection child={child} canEdit={canEdit} reload={reload} />
      <ProblemAlert problem={problem} />
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
