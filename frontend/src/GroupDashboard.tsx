import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import AlertMarker from './AlertMarker'
import {
  absenceReasonLabel,
  addAbsence,
  attendanceStep,
  childPhotoUrl,
  fetchChild,
  fetchGroupDashboard,
  pickUpPhotoUrl,
  removeAbsence,
  type AbsenceReason,
  type ChildProfile,
  type GroupChild,
} from './api'
import { longDay } from './calendarDates'
import DayBar from './DayBar'
import { kitaTime } from './dates'
import GroupLabel from './GroupLabel'
import IncidentReport from './IncidentReport'
import ProblemAlert from './ProblemAlert'
import { useProfileChange } from './profileChange'
import { useRecordAtAddress } from './recordAtAddress'
import { useRefresh } from './refresh'
import UpdatedNote from './UpdatedNote'
import RecordPlaceholder from './RecordPlaceholder'
import Icon from './Icon'

type Status = 'here' | 'gone' | 'absent' | 'notYet'


function statusOf(child: GroupChild): Status {
  if (child.absence) return 'absent'
  if (!child.attendance) return 'notYet'
  return child.attendance.checkedOutAt ? 'gone' : 'here'
}

/** The Group dashboard, the Today view: where a Staff member lands after picking their Group.
 * Each Child's day, with large buttons to check them in and out or record an Absence; the
 * Alerts and today's Birthdays. */
export default function GroupDashboard() {
  const { t, i18n } = useTranslation()
  const [loaded, reload] = useRecordAtAddress(fetchGroupDashboard)
  // A tablet by the door stays current; open forms and panels stay as they are.
  useRefresh(reload)
  // In the morning: only the Children still to come.
  const [notYetOnly, setNotYetOnly] = useState(false)
  const dashboard = loaded.record
  if (!dashboard) return <RecordPlaceholder {...loaded} backTo={{ to: '/', label: t('backToStart') }} />
  const statuses = dashboard.children.map(statusOf)
  const count = (status: Status) => statuses.filter((each) => each === status).length
  const birthdays = dashboard.children.filter((child) => child.birthdayToday)

  return (
    <section className="page dashboard">
      <h2>
        <GroupLabel group={dashboard} />
      </h2>
      <h3>{t('todayIs', { day: longDay(dashboard.day, i18n.language) })}</h3>
      {birthdays.length > 0 && (
        <p className="birthday-banner">
          <Icon name="birthday" />
          {t('birthdayToday', { names: birthdays.map((child) => `${child.firstName} ${child.lastName}`).join(', ') })}
        </p>
      )}
      {dashboard.children.length === 0 ? (
        <p>{t('noChildrenInGroup')}</p>
      ) : (
        <>
          <UpdatedNote updatedAt={loaded.loadedAt ?? null} stale={loaded.failed} />
          <DayBar day={{ here: count('here'), gone: count('gone'), absent: count('absent'), notYet: count('notYet') }} />
          <button type="button" aria-pressed={notYetOnly} onClick={() => setNotYetOnly(!notYetOnly)}>
            {t('onlyNotHereYet')}
          </button>
          <ul className="today-list">
            {dashboard.children
              .filter((child) => !notYetOnly || statusOf(child) === 'notYet')
              .map((child) => (
                <ChildToday key={child.id} child={child} day={dashboard.day} reload={reload} />
              ))}
          </ul>
        </>
      )}
    </section>
  )
}

type ChildProps = { child: GroupChild; day: string; reload: () => void }

/** One Child's card in the Today view. */
function ChildToday({ child, day, reload }: ChildProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const { problem, change } = useProfileChange(reload)
  const [recordingAbsence, setRecordingAbsence] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const name = `${child.firstName} ${child.lastName}`
  const status = statusOf(child)

  function statusText(): string {
    const { absence, attendance } = child
    switch (status) {
      case 'absent': {
        const reason = t(absenceReasonLabel[absence!.reason])
        return absence!.endsOn === day ? t('statusAbsent', { reason }) : t('statusAbsentUntil', { reason, day: longDay(absence!.endsOn, language) })
      }
      case 'notYet':
        return t('notHereYet')
      case 'gone':
        return t('goneHomeAt', { time: kitaTime(attendance!.checkedOutAt!, language) })
      case 'here':
        return t('hereSince', { time: kitaTime(attendance!.checkedInAt, language) })
    }
  }

  return (
    <li className={`today-child ${status}`} aria-label={name}>
      {child.photoId === null ? (
        <div className="today-photo placeholder" aria-hidden="true">
          {child.firstName.charAt(0)}
          {child.lastName.charAt(0)}
        </div>
      ) : (
        <img className="today-photo" src={childPhotoUrl(child.id, child.photoId, 'thumbnail')} alt={t('photoOf', { name })} />
      )}
      <div className="today-name">
        <Link to={`/children/${child.id}`}>{name}</Link> <AlertMarker label={t('alertsMarker')} alerts={child.alerts} />
      </div>
      <p className="today-status">
        <Icon name={status} />
        {statusText()}
      </p>
      {child.birthdayToday && (
        <p className="birthday-mark">
          <Icon name="birthday" />
          {t('birthdayMark')}
        </p>
      )}
      {recordingAbsence ? (
        <AbsenceForm
          name={name}
          day={day}
          onSave={async (absence) => {
            const saved = await change(() => addAbsence(child.id, absence))
            if (saved) setRecordingAbsence(false)
            return saved
          }}
          onCancel={() => setRecordingAbsence(false)}
        />
      ) : checkingOut ? (
        <CheckOutPanel
          childId={child.id}
          name={name}
          onCheckOut={async () => {
            if (await change(() => attendanceStep(child.id, 'check-out'))) setCheckingOut(false)
          }}
          onCancel={() => setCheckingOut(false)}
        />
      ) : (
        <div className="actions">
          {status === 'notYet' && (
            <>
              <button type="button" className="primary big" aria-label={t('checkInNamed', { name })} onClick={() => void change(() => attendanceStep(child.id, 'check-in'))}>
                {t('checkIn')}
              </button>
              <button type="button" aria-label={t('absentNamed', { name })} onClick={() => setRecordingAbsence(true)}>
                {t('absent')}
              </button>
            </>
          )}
          {status === 'here' && (
            <button type="button" className="primary big" aria-label={t('checkOutNamed', { name })} onClick={() => setCheckingOut(true)}>
              {t('checkOut')}
            </button>
          )}
          {(status === 'here' || status === 'gone') && (
            <button type="button" aria-label={t('undoNamed', { name })} onClick={() => void change(() => attendanceStep(child.id, 'undo'))}>
              {t('undo')}
            </button>
          )}
          {status === 'absent' && child.absence && (
            <button type="button" aria-label={t('removeAbsenceNamed', { name })} onClick={() => void change(() => removeAbsence(child.id, child.absence!.id))}>
              {t('removeAbsence')}
            </button>
          )}
        </div>
      )}
      <ProblemAlert problem={problem} />
      <IncidentReport childId={child.id} name={name} />
    </li>
  )
}

type CheckOutPanelProps = { childId: number; name: string; onCheckOut: () => Promise<void>; onCancel: () => void }

/** Before a Child goes home: who may pick them up, with photos, to check against the person at
 * the door. */
function CheckOutPanel({ childId, name, onCheckOut, onCancel }: CheckOutPanelProps) {
  const { t } = useTranslation()
  const [profile, setProfile] = useState<ChildProfile | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchChild(childId)
      .then(setProfile)
      .catch(() => setFailed(true))
  }, [childId])

  const people = profile
    ? [
        ...profile.parents
          .filter((parent) => parent.mayPickUp)
          .map((parent) => ({
            key: `parent-${parent.id}`,
            name: `${parent.firstName} ${parent.lastName}`,
            relationship: t('parent'),
            photo: parent.photoId === null ? null : pickUpPhotoUrl({ parentId: parent.id }, parent.photoId, 'thumbnail'),
          })),
        ...profile.pickUpPersons.map((person) => ({
          key: `contact-${person.id}`,
          name: person.name,
          relationship: person.relationship,
          photo: person.photoId === null ? null : pickUpPhotoUrl({ childId, contactId: person.id }, person.photoId, 'thumbnail'),
        })),
      ]
    : []

  return (
    <section className="check-out" aria-label={t('whoMayPickUpNamed', { name })}>
      <h4>{t('whoMayPickUp')}</h4>
      {failed ? (
        <p className="status status-problem">{t('somethingWentWrong')}</p>
      ) : profile === undefined ? (
        <p>{t('loading')}</p>
      ) : people.length === 0 ? (
        <p>{t('nobodyMayPickUp')}</p>
      ) : (
        <ul>
          {people.map((person) => (
            <li key={person.key} className="contact">
              {person.photo && <img src={person.photo} alt={t('photoOf', { name: person.name })} />}
              <strong>{person.name}</strong>
              {person.relationship && <span> ({person.relationship})</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="actions">
        <button
          type="button"
          className="primary big"
          aria-label={t('goesHomeNowNamed', { name })}
          disabled={submitting}
          onClick={() => {
            setSubmitting(true)
            void onCheckOut().finally(() => setSubmitting(false))
          }}
        >
          {t('goesHomeNow')}
        </button>
        <button type="button" onClick={onCancel}>
          {t('notNow')}
        </button>
      </div>
    </section>
  )
}

type AbsenceFormProps = {
  name: string
  day: string
  onSave: (absence: { startsOn: string; endsOn: string; reason: AbsenceReason }) => Promise<boolean>
  onCancel: () => void
}

/** Records that a Child will not come: from today, or another day, until a day. */
function AbsenceForm({ name, day, onSave, onCancel }: AbsenceFormProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState<AbsenceReason>('sick')
  const [startsOn, setStartsOn] = useState(day)
  const [endsOn, setEndsOn] = useState(day)
  const [submitting, setSubmitting] = useState(false)

  function moveStart(start: string) {
    setStartsOn(start)
    if (start && endsOn < start) setEndsOn(start)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    if (!(await onSave({ startsOn, endsOn, reason }))) setSubmitting(false)
  }

  return (
    <form className="contact-form" aria-label={t('absenceOf', { name })} onSubmit={(event) => void submit(event)}>
      <label>
        {t('absenceReason')}
        <select value={reason} onChange={(event) => setReason(event.target.value as AbsenceReason)}>
          {(Object.keys(absenceReasonLabel) as AbsenceReason[]).map((each) => (
            <option key={each} value={each}>
              {t(absenceReasonLabel[each])}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('absenceFrom')}
        <input type="date" required value={startsOn} onChange={(event) => moveStart(event.target.value)} />
      </label>
      <label>
        {t('absenceUntil')}
        <input type="date" required min={startsOn} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />
      </label>
      <div className="actions">
        <button type="submit" className="primary" disabled={submitting}>
          {t('save')}
        </button>
        <button type="button" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
