import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import AlertMarker from './AlertMarker'
import AllergyBar from './AllergyBar'
import NameTag from './NameTag'
import {
  absenceReasonLabel,
  addAbsence,
  attendanceStep,
  fetchChild,
  fetchGroupDashboard,
  pickUpPhotoUrl,
  removeAbsence,
  type AbsenceReason,
  type ChildProfile,
  type GroupChild,
  type GroupColour,
} from './api'
import { longDay } from './calendarDates'
import SummaryStrip from './SummaryStrip'
import { TodaySkeleton } from './DayHeader'
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
import { useToast } from './toastContext'

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
  const toast = useToast()
  // Undo from a toast: here, not on the tag, which may have left the list meanwhile.
  const { problem: undoProblem, change: undoChange } = useProfileChange(reload)
  // Steps just taken on this board, by Child: confirmed once the board shows them, with the
  // server's time.
  const taken = useRef(new Map<number, 'here' | 'gone'>())
  // The tag last tapped: the only one whose drop is animated (not one a refresh moves).
  const [lastTapped, setLastTapped] = useState<number | null>(null)
  useEffect(() => {
    for (const child of loaded.record?.children ?? []) {
      const after = taken.current.get(child.id)
      if (after === undefined || statusOf(child) !== after) continue
      taken.current.delete(child.id)
      const time = kitaTime(after === 'here' ? child.attendance!.checkedInAt : child.attendance!.checkedOutAt!, i18n.language)
      toast(t(after === 'here' ? 'toastHere' : 'toastGone', { name: child.firstName, time }), () => void undoChange(() => attendanceStep(child.id, 'undo')))
    }
  })
  const dashboard = loaded.record
  // While loading: grey blocks in the page's shape, so nothing jumps when it comes.
  if (dashboard === undefined && !loaded.failed) return <TodaySkeleton />
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
      <AllergyBar
        colour={dashboard.colour}
        items={dashboard.children.filter((child) => child.alerts.length > 0 && ['here', 'notYet'].includes(statusOf(child)))}
      />
      {dashboard.children.length === 0 ? (
        <p>{t('noChildrenInGroup')}</p>
      ) : (
        <>
          <SummaryStrip
            day={{ here: count('here'), gone: count('gone'), absent: count('absent'), notYet: count('notYet') }}
            birthdays={birthdays.map((child) => `${child.firstName} ${child.lastName}`)}
            colour={dashboard.colour}
          />
          <UpdatedNote updatedAt={loaded.loadedAt ?? null} stale={loaded.failed} />
          <button type="button" aria-pressed={notYetOnly} onClick={() => setNotYetOnly(!notYetOnly)}>
            {t('onlyNotHereYet')}
          </button>
          <ProblemAlert problem={undoProblem} />
          {/* The chalkboard: each Child's name tag hangs from the rail once they are here. */}
          <div className={`board group-colour-${dashboard.colour}`}>
            <ul className="board-tags" aria-label={t('boardOfChildren')}>
              {dashboard.children
                .filter((child) => !notYetOnly || statusOf(child) === 'notYet')
                .map((child) => (
                  <ChildToday
                    key={child.id}
                    child={child}
                    day={dashboard.day}
                    colour={dashboard.colour}
                    reload={reload}
                    tapped={lastTapped === child.id}
                    onStep={(after) => {
                      if (after === null) taken.current.delete(child.id)
                      else {
                        taken.current.set(child.id, after)
                        setLastTapped(child.id)
                      }
                    }}
                  />
                ))}
            </ul>
          </div>
        </>
      )}
    </section>
  )
}

type ChildProps = {
  child: GroupChild
  day: string
  colour: GroupColour
  reload: () => void
  /** Whether this tag was the last tapped: only then is its drop animated. */
  tapped: boolean
  /** Tells the board about a step taken (to confirm it with a toast), or null if it was refused. */
  onStep: (after: 'here' | 'gone' | null) => void
}

// What a tap on a tag does, as its name says: check in, open the pick-up check, or show Undo.
const tagAction = { notYet: 'checkInNamed', here: 'checkOutNamed', gone: 'goneHomeNamed' } as const

/** One Child's name tag on the board, with what can be done for them below it. A tap on the tag
 * does the day's next step: check in at once, or open the pick-up check before checking out. */
function ChildToday({ child, day, colour, reload, tapped, onStep }: ChildProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const { problem, change } = useProfileChange(reload)
  const [recordingAbsence, setRecordingAbsence] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const stateId = useId()
  const alertId = useId()
  const hasAlerts = child.alerts.length > 0
  const name = `${child.firstName} ${child.lastName}`
  const status = statusOf(child)
  const undo = () => void change(() => attendanceStep(child.id, 'undo'))

  async function step(which: 'check-in' | 'check-out'): Promise<boolean> {
    onStep(which === 'check-in' ? 'here' : 'gone')
    const done = await change(() => attendanceStep(child.id, which))
    if (!done) onStep(null)
    return done
  }

  function stateText(): string {
    const { absence, attendance } = child
    switch (status) {
      case 'absent': {
        const reason = t(absenceReasonLabel[absence!.reason])
        return absence!.endsOn === day ? t('statusAbsent', { reason }) : t('statusAbsentUntil', { reason, day: longDay(absence!.endsOn, language) })
      }
      case 'notYet':
        return t('notHereYet')
      case 'gone':
        return t('tagGone', { time: kitaTime(attendance!.checkedOutAt!, language) })
      case 'here':
        return t('tagHere', { time: kitaTime(attendance!.checkedInAt, language) })
    }
  }

  const tag = (
    <NameTag name={`${child.firstName} ${child.lastName.charAt(0)}.`} symbol={child.symbol} colour={colour}>
      <span className="name-tag-state" id={stateId}>
        {stateText()}
      </span>
      {/* Named by the allergen on the tag itself: a tablet has no hover. */}
      {hasAlerts && (
        <span className="tag-alert" id={alertId}>
          <AlertMarker label={t('alertsMarker')} alerts={child.alerts} />
        </span>
      )}
    </NameTag>
  )

  return (
    <li className={`board-cell ${status}${tapped ? ' tapped' : ''}`} aria-label={name}>
      <div className="tag-hanger">
        {status === 'absent' ? (
          <div className="board-tag">{tag}</div>
        ) : (
          <button
            type="button"
            className="board-tag"
            aria-describedby={hasAlerts ? `${stateId} ${alertId}` : stateId}
            aria-label={t(tagAction[status], { name })}
            aria-expanded={status === 'notYet' ? undefined : checkingOut}
            onClick={() => (status === 'notYet' ? void step('check-in') : setCheckingOut(!checkingOut))}
          >
            {tag}
          </button>
        )}
        {/* The raspberry circle on the tag's corner; the allergen is named on the tag. */}
        {hasAlerts && (
          <span className="tag-flag" aria-hidden="true">
            <Icon name="alert" />
          </span>
        )}
      </div>
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
      ) : checkingOut && status === 'here' ? (
        <CheckOutPanel
          childId={child.id}
          name={name}
          onCheckOut={async () => {
            if (await step('check-out')) setCheckingOut(false)
          }}
          onCancel={() => setCheckingOut(false)}
        />
      ) : checkingOut && status === 'gone' ? (
        <div className="tag-panel actions">
          <button
            type="button"
            aria-label={t('undoNamed', { name })}
            onClick={() => {
              setCheckingOut(false)
              undo()
            }}
          >
            {t('undo')}
          </button>
          <button type="button" onClick={() => setCheckingOut(false)}>
            {t('notNow')}
          </button>
        </div>
      ) : (
        <div className="tag-actions">
          {status === 'notYet' && (
            <button type="button" aria-label={t('absentNamed', { name })} onClick={() => setRecordingAbsence(true)}>
              {t('absent')}
            </button>
          )}
          {status === 'here' && (
            <button type="button" aria-label={t('undoNamed', { name })} onClick={undo}>
              {t('undo')}
            </button>
          )}
          {status === 'absent' && child.absence && (
            <button type="button" aria-label={t('removeAbsenceNamed', { name })} onClick={() => void change(() => removeAbsence(child.id, child.absence!.id))}>
              {t('removeAbsence')}
            </button>
          )}
          <TagMenu childId={child.id} name={name} />
        </div>
      )}
      <ProblemAlert problem={problem} />
    </li>
  )
}

/** "More" under a name tag: the Child's profile, and reporting an Incident. */
function TagMenu({ childId, name }: { childId: number; name: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <>
      <button type="button" aria-label={t('moreForNamed', { name })} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
        {t('more')}
      </button>
      <div id={panelId} className="tag-panel" hidden={!open}>
        <Link to={`/children/${childId}`}>{t('profileOfNamed', { name })}</Link>
        <IncidentReport childId={childId} name={name} />
      </div>
    </>
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
