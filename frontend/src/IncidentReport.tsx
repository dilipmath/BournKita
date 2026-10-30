import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { reportIncident } from './api'
import { kitaToday } from './dates'
import ProblemAlert from './ProblemAlert'
import type { Problem } from './profileChange'

type Props = { childId: number; name: string }

/** "Report incident" for one Child: opens a form in place, and says once it is reported. An
 * Incident is a fixed record: it cannot be changed afterwards. */
export default function IncidentReport({ childId, name }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [reported, setReported] = useState(false)
  const [happenedOn, setHappenedOn] = useState(kitaToday)
  const [happenedAt, setHappenedAt] = useState('')
  const [description, setDescription] = useState('')
  const [informed, setInformed] = useState('')
  const [problem, setProblem] = useState<Problem>(null)
  const [submitting, setSubmitting] = useState(false)

  function start() {
    setReported(false)
    setProblem(null)
    setHappenedOn(kitaToday())
    setHappenedAt('')
    setDescription('')
    setInformed('')
    setOpen(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setProblem(null)
    try {
      const result = await reportIncident(childId, { happenedOn, happenedAt: happenedAt || null, description, informed })
      if (typeof result === 'string') setProblem(result)
      else {
        setOpen(false)
        setReported(true)
      }
    } catch {
      setProblem('somethingWentWrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="incident-report">
      {open ? (
        <form className="contact-form" aria-label={t('incidentOf', { name })} onSubmit={(event) => void submit(event)}>
          <label>
            {t('incidentDate')}
            <input type="date" required max={kitaToday()} value={happenedOn} onChange={(event) => setHappenedOn(event.target.value)} />
          </label>
          <label>
            {t('incidentTime')}
            <input type="time" value={happenedAt} onChange={(event) => setHappenedAt(event.target.value)} />
          </label>
          <label>
            {t('incidentDescription')}
            <textarea required maxLength={4000} autoFocus value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label>
            {t('incidentInformed')}
            <input required maxLength={500} value={informed} onChange={(event) => setInformed(event.target.value)} />
          </label>
          <p className="hint">{t('incidentIsFixed')}</p>
          <div className="actions">
            <button type="submit" className="primary" disabled={submitting}>
              {t('save')}
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              {t('cancel')}
            </button>
          </div>
          <ProblemAlert problem={problem} />
        </form>
      ) : (
        <button type="button" aria-label={t('reportIncidentNamed', { name })} onClick={start}>
          {t('reportIncident')}
        </button>
      )}
      {reported && (
        <p className="status status-ok" role="status">
          {t('incidentReported')}
        </p>
      )}
    </div>
  )
}
