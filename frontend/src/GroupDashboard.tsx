import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import AlertMarker from './AlertMarker'
import {
  absenceReasonLabel,
  addAbsence,
  attendanceStep,
  fetchGroupDashboard,
  removeAbsence,
  type AbsenceReason,
  type GroupChild,
} from './api'
import { longDay } from './calendarDates'
import EmergencyListLink from './EmergencyListLink'
import { kitaTime } from './dates'
import GroupLabel from './GroupLabel'
import IncidentReport from './IncidentReport'
import ProblemAlert from './ProblemAlert'
import { useProfileChange } from './profileChange'
import { useRecordAtAddress } from './recordAtAddress'
import RecordPlaceholder from './RecordPlaceholder'

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
      <nav className="actions" aria-label={t('groupViews')}>
        <Link className="button" to={`/groups/${dashboard.id}/board`}>
          {t('taskBoard')}
        </Link>
        <Link className="button" to={`/groups/${dashboard.id}/calendar`}>
          {t('calendar')}
        </Link>
        <EmergencyListLink groupId={dashboard.id} />
      </nav>
      <h3>{t('todayIs', { day: longDay(dashboard.day, i18n.language) })}</h3>
      {birthdays.length > 0 && (
        <p className="birthday-banner">
          <span aria-hidden="true">🎂 </span>
          {t('birthdayToday', { names: birthdays.map((child) => `${child.firstName} ${child.lastName}`).join(', ') })}
        </p>
      )}
      {dashboard.children.length === 0 ? (
        <p>{t('noChildrenInGroup')}</p>
      ) : (
        <>
          <p className="today-counts">
            {t('todayCounts', { here: count('here'), gone: count('gone'), absent: count('absent'), notYet: count('notYet') })}
          </p>
          <ul className="today-list">
            {dashboard.children.map((child) => (
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
      <div className="today-name">
        <Link to={`/children/${child.id}`}>{name}</Link> <AlertMarker label={t('alertsMarker')} alerts={child.alerts} />
      </div>
      <p className="today-status">{statusText()}</p>
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
            <button type="button" className="primary big" aria-label={t('checkOutNamed', { name })} onClick={() => void change(() => attendanceStep(child.id, 'check-out'))}>
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
