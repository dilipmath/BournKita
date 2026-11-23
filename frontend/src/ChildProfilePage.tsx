import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AlertMarker from './AlertMarker'
import AbsencesSection from './AbsencesSection'
import AlertsBanner from './AlertsBanner'
import { fullDate } from './calendarDates'
import { childPhotoUrl, deleteChild, fetchChild, genderLabel, type ChildProfile } from './api'
import ChildForm from './ChildForm'
import ChildGroup from './ChildGroup'
import ChildSymbol from './ChildSymbol'
import ConsentsSection from './ConsentsSection'
import ContactsSection from './ContactsSection'
import { kitaToday } from './dates'
import GallerySection from './GallerySection'
import GroupLabel from './GroupLabel'
import Icon from './Icon'
import IncidentReport from './IncidentReport'
import Panel from './Panel'
import ParentsSection from './ParentsSection'
import ProblemAlert from './ProblemAlert'
import type { Problem } from './profileChange'
import { useRecordAtAddress } from './recordAtAddress'
import RecordPlaceholder from './RecordPlaceholder'

type Props = {
  canEdit: boolean
  /** How many months the Archive keeps a deleted profile: said before an Admin archives one. */
  retentionMonths: number
}

/** Full years between a date of birth and a day (both YYYY-MM-DD). */
function yearsOld(dateOfBirth: string, day: string): number {
  const years = Number(day.slice(0, 4)) - Number(dateOfBirth.slice(0, 4))
  return day.slice(5) < dateOfBirth.slice(5) ? years - 1 : years
}

/** One Child's profile, as a drawer over the Children list (which stays where it was): a header in
 * the Group colour, then the sections staff need, safety first. Admins edit and archive it from
 * here; Teachers read it, with a note on who makes changes. Esc or Close goes back to the list. */
export default function ChildProfilePage({ canEdit, retentionMonths }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [loaded, reload] = useRecordAtAddress(fetchChild)
  const drawer = useRef<HTMLDialogElement>(null)
  const headingId = useId()

  useEffect(() => {
    // Modal: focus moves in, the list behind is out of reach until it closes.
    const dialog = drawer.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const backToList = () => navigate({ pathname: '/children', search: location.search })
  const child = loaded.record

  return (
    <dialog
      ref={drawer}
      className={child?.group ? `drawer group-colour-${child.group.colour}` : 'drawer'}
      aria-labelledby={child ? headingId : undefined}
      aria-label={child ? undefined : t('loading')}
      onClose={backToList}
    >
      {child ? (
        <ChildProfile child={child} headingId={headingId} canEdit={canEdit} retentionMonths={retentionMonths} reload={reload} onClose={() => drawer.current?.close()} />
      ) : (
        <div className="drawer-body">
          <button type="button" className="drawer-close" onClick={() => drawer.current?.close()}>
            {t('close')}
          </button>
          <RecordPlaceholder {...loaded} backTo={{ to: '/children', label: t('backToChildren') }} />
        </div>
      )}
    </dialog>
  )
}

type ProfileProps = Props & { child: ChildProfile; headingId: string; reload: () => void; onClose: () => void }

function ChildProfile({ child, headingId, canEdit, retentionMonths, reload, onClose }: ProfileProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [problem, setProblem] = useState<Problem>(null)
  const confirmation = useRef<HTMLDivElement>(null)
  const name = `${child.firstName} ${child.lastName}`

  useEffect(() => {
    // The Archive button just disappeared; take keyboard and screen reader users to the question.
    if (confirming) confirmation.current?.focus()
  }, [confirming])

  async function archive() {
    setProblem(null)
    try {
      const result = await deleteChild(child.id)
      if (result === true) navigate('/children', { state: { archived: name } })
      else setProblem(result)
    } catch {
      setProblem('somethingWentWrong')
    }
  }

  return (
    <>
      <header className="profile-head">
        {/* The Symbol, as on the coat hook; beside it the newest photo, none without photo Consent. */}
        <span className="profile-symbol">
          <ChildSymbol symbol={child.symbol} />
        </span>
        {child.photos[0] && <img className="profile-photo" src={childPhotoUrl(child.id, child.photos[0].id, 'thumbnail')} alt={t('photoOf', { name })} />}
        <div>
          <h2 id={headingId}>{name}</h2>
          <p>
            {child.dateOfBirth && <>{t('yearsOld', { count: yearsOld(child.dateOfBirth, kitaToday()) })} · </>}
            {child.group ? <GroupLabel group={child.group} /> : t('noGroup')}
          </p>
        </div>
        <button type="button" className="drawer-close" onClick={onClose}>
          {t('close')}
        </button>
      </header>
      <div className="drawer-body">
        {canEdit ? (
          confirming ? (
            // A second, deliberate step; an Admin can restore it from the Archive.
            <div className="confirm" role="group" aria-label={t('archiveProfile')} tabIndex={-1} ref={confirmation}>
              <p>{t('confirmArchiveChild', { name, count: retentionMonths })}</p>
              <div className="actions">
                <button type="button" className="danger" onClick={() => void archive()}>
                  {t('archiveProfile')}
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
                {t('archiveChild')}
              </button>
              <Link className="button" to={`/audit-log?child=${child.id}`}>
                {t('auditLogForChild')}
              </Link>
            </div>
          )
        ) : (
          <p className="lock-note">
            <Icon name="privacy" />
            {t('profileLockNote')}
          </p>
        )}
        <ProblemAlert problem={problem} />
        <AlertsBanner childId={child.id} alerts={child.alerts} canEdit={canEdit} reload={reload} />
        <Panel icon="person">
          <ParentsSection child={child} canEdit={canEdit} reload={reload} />
        </Panel>
        <Panel icon="safety">
          <ContactsSection kind="emergency" childId={child.id} contacts={child.emergencyContacts} canEdit={canEdit} reload={reload} />
        </Panel>
        <Panel icon="home">
          <ContactsSection kind="pickUp" childId={child.id} contacts={child.pickUpPersons} parents={child.parents} canEdit={canEdit} reload={reload} />
        </Panel>
        <Panel icon="privacy">
          <ConsentsSection childId={child.id} consents={child.consents} canEdit={canEdit} reload={reload} />
        </Panel>
        <Panel icon="sprout" title={t('foodPreferences')}>
          <p>
            {child.foodPreferences || '–'}{' '}
            {/* So nobody serves the Child something dangerous. */}
            <AlertMarker label={t('allergies')} alerts={child.alerts.filter((alert) => alert.kind === 'allergy')} />
          </p>
        </Panel>
        <Panel icon="globe" title={t('languagesSpoken')}>
          <p>{child.languages || '–'}</p>
        </Panel>
        <Panel icon="children" title={t('childDetails')}>
            <dl>
              <ChildGroup child={child} canEdit={canEdit} reload={reload} />
              <dt>{t('gender')}</dt>
              <dd>{t(child.gender ? genderLabel[child.gender] : 'genderNotStated')}</dd>
              <dt>{t('dateOfBirth')}</dt>
              <dd>{child.dateOfBirth ? fullDate(child.dateOfBirth, i18n.language) : '–'}</dd>
              <dt>{t('interests')}</dt>
              <dd>{child.interests || '–'}</dd>
            </dl>
        </Panel>
        <Panel icon="calendar">
          <AbsencesSection childId={child.id} absences={child.absences} reload={reload} />
        </Panel>
        <Panel icon="children">
          <GallerySection child={child} canEdit={canEdit} reload={reload} />
        </Panel>
        <IncidentReport childId={child.id} name={name} />
      </div>
    </>
  )
}

/** The form for changing the Child profile named by the address. Admins only. */
export function ChildEditPage() {
  const [loaded] = useRecordAtAddress(fetchChild)
  // Keyed by ID, so the form starts afresh for another Child.
  return loaded.record ? <ChildForm key={loaded.record.id} child={loaded.record} /> : <RecordPlaceholder {...loaded} />
}
