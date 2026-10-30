import { useEffect, useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { addFollowUp, fetchChildren, fetchIncidents, type ChildSummary, type Incident, type IncidentFilter } from './api'
import { longDate } from './calendarDates'
import { kitaDateTime } from './dates'
import GroupOptions from './GroupOptions'
import ProblemAlert from './ProblemAlert'
import type { Problem } from './profileChange'
import { useGroups } from './useGroups'

/** The Incident log: an Admin's of every Child, a Teacher's those they reported; newest first,
 * filtered by Child, Group and dates. Admins add Follow-ups; nobody changes an Incident. */
export default function IncidentLogPage({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<IncidentFilter>({})
  const [incidents, setIncidents] = useState<Incident[] | 'failed'>()
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let latest = true
    fetchIncidents(filter)
      .then((found) => latest && setIncidents(found))
      .catch(() => latest && setIncidents('failed'))
    return () => {
      latest = false
    }
  }, [filter, version])

  return (
    <section className="page incident-log">
      <h2>{t('incidentLog')}</h2>
      <p>{t(isAdmin ? 'incidentLogExplained' : 'incidentLogOwn')}</p>
      <IncidentFilters onShow={setFilter} />
      {incidents === undefined ? (
        <p>{t('loading')}</p>
      ) : incidents === 'failed' ? (
        <p className="status status-problem" role="alert">
          {t('somethingWentWrong')}
        </p>
      ) : incidents.length === 0 ? (
        <p>{t('noIncidents')}</p>
      ) : (
        incidents.map((incident) => (
          <IncidentEntry key={incident.id} incident={incident} isAdmin={isAdmin} onFollowedUp={() => setVersion((current) => current + 1)} />
        ))
      )}
    </section>
  )
}

/** The filters, applied with "Show". */
function IncidentFilters({ onShow }: { onShow: (filter: IncidentFilter) => void }) {
  const { t } = useTranslation()
  const groups = useGroups()
  const [children, setChildren] = useState<ChildSummary[]>([])
  const [childId, setChildId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const childField = useId()
  const groupField = useId()

  useEffect(() => {
    fetchChildren('')
      .then(setChildren)
      .catch(() => setChildren([]))
  }, [])

  function show(event: FormEvent) {
    event.preventDefault()
    onShow({
      ...(childId && { childId: Number(childId) }),
      ...(groupId && { groupId: Number(groupId) }),
      ...(since && { since }),
      ...(until && { until }),
    })
  }

  return (
    <form role="search" aria-label={t('filterIncidentLog')} className="filters" onSubmit={show}>
      {/* Beside the drop-downs, not around them, so the picked option does not join their names. */}
      <div className="field">
        <label htmlFor={childField}>{t('child')}</label>
        <select id={childField} value={childId} onChange={(event) => setChildId(event.target.value)}>
          <option value="">{t('allChildren')}</option>
          {children.map((child) => (
            <option key={child.id} value={child.id}>
              {child.firstName} {child.lastName}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={groupField}>{t('group')}</label>
        <select id={groupField} value={groupId} onChange={(event) => setGroupId(event.target.value)}>
          <option value="">{t('allGroups')}</option>
          <GroupOptions groups={groups ?? []} />
        </select>
      </div>
      <label>
        {t('from')}
        <input type="date" value={since} onChange={(event) => setSince(event.target.value)} />
      </label>
      <label>
        {t('until')}
        <input type="date" value={until} onChange={(event) => setUntil(event.target.value)} />
      </label>
      <button type="submit" className="primary">
        {t('show')}
      </button>
    </form>
  )
}

type EntryProps = { incident: Incident; isAdmin: boolean; onFollowedUp: () => void }

/** One Incident, with its Follow-ups. */
function IncidentEntry({ incident, isAdmin, onFollowedUp }: EntryProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const name = `${incident.child.firstName} ${incident.child.lastName}`
  const day = longDate(incident.happenedOn, language)

  return (
    <article className="incident" aria-label={`${name}, ${day}`}>
      <h3>
        <Link to={`/children/${incident.child.id}`}>{name}</Link>, {day}
      </h3>
      {incident.happenedAt && <p>{t('incidentAt', { time: incident.happenedAt.slice(0, 5) })}</p>}
      <p className="note">{incident.description}</p>
      <p>{t('informedWho', { who: incident.informed })}</p>
      <p className="hint">
        {t('reportedBy', { who: incident.reportedBy ?? t('formerStaffMember'), time: kitaDateTime(incident.reportedAt, language) })}
      </p>
      {incident.followUps.length > 0 && (
        <ul className="follow-ups" aria-label={t('followUps')}>
          {incident.followUps.map((followUp) => (
            <li key={followUp.id}>
              <p className="note">{followUp.note}</p>
              <p className="hint">{t('followUpBy', { who: followUp.author ?? t('formerStaffMember'), time: kitaDateTime(followUp.at, language) })}</p>
            </li>
          ))}
        </ul>
      )}
      {isAdmin && <FollowUpForm incidentId={incident.id} onAdded={onFollowedUp} />}
    </article>
  )
}

function FollowUpForm({ incidentId, onAdded }: { incidentId: number; onAdded: () => void }) {
  const { t } = useTranslation()
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState<Problem>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setProblem(null)
    try {
      const result = await addFollowUp(incidentId, note)
      if (typeof result === 'string') setProblem(result)
      else {
        setNote('')
        onAdded()
      }
    } catch {
      setProblem('somethingWentWrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="follow-up-form" onSubmit={(event) => void submit(event)}>
      <label>
        {t('followUp')}
        <textarea required maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="actions">
        <button type="submit" disabled={submitting}>
          {t('addFollowUp')}
        </button>
      </div>
      <ProblemAlert problem={problem} />
    </form>
  )
}
