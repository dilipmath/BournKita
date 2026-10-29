import { useEffect, useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { fetchImportedHolidays, holidayKinds, importHolidays, type HolidayKind, type HolidaysImported } from './api'
import { fullDate } from './calendarDates'
import ProblemAlert from './ProblemAlert'
import type { Problem } from './profileChange'

const kinds = Object.keys(holidayKinds) as HolidayKind[]

/** Where an Admin imports the region's public and school holidays from iCal files (e.g. from a
 * holiday website). Each import replaces the holidays of its kind; the Calendar shows them. */
export default function HolidaysPage() {
  const { t } = useTranslation()
  const [imported, setImported] = useState<HolidaysImported[]>()
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    fetchImportedHolidays()
      .then((result) => (typeof result === 'string' ? setFailed(true) : setImported(result)))
      .catch(() => setFailed(true))
  }, [version])

  return (
    <section className="page holidays">
      <Link to="/calendar">{t('backToCalendar')}</Link>
      <h2>{t('holidays')}</h2>
      <p>{t('holidaysExplained')}</p>
      {failed && (
        <p className="status status-problem" role="alert">
          {t('somethingWentWrong')}
        </p>
      )}
      {kinds.map((kind) => (
        <HolidayImport key={kind} kind={kind} imported={imported?.find((each) => each.kind === kind)} loaded={imported !== undefined} onImported={() => setVersion((current) => current + 1)} />
      ))}
    </section>
  )
}

type ImportProps = { kind: HolidayKind; imported: HolidaysImported | undefined; loaded: boolean; onImported: () => void }

/** One kind of holidays: what is imported, and a file to import in its place. */
function HolidayImport({ kind, imported, loaded, onImported }: ImportProps) {
  const { t, i18n } = useTranslation()
  const headingId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [problem, setProblem] = useState<Problem>(null)
  const [done, setDone] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    setImporting(true)
    setProblem(null)
    setDone(null)
    try {
      const result = await importHolidays(kind, file)
      if (typeof result === 'string') setProblem(result)
      else {
        setDone(result)
        onImported()
      }
    } catch {
      setProblem('somethingWentWrong')
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="holiday-import" aria-labelledby={headingId}>
      <h3 id={headingId}>{t(holidayKinds[kind].heading)}</h3>
      {loaded && (
        <p>
          {imported
            ? t('holidaysImported', { count: imported.count, first: fullDate(imported.firstDay, i18n.language), last: fullDate(imported.lastDay, i18n.language) })
            : t('noHolidaysYet')}
        </p>
      )}
      <form className="contact-form" onSubmit={(event) => void submit(event)}>
        <label>
          {t('icalFile')}
          <input type="file" accept=".ics,text/calendar" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <div className="actions">
          <button type="submit" className="primary" disabled={!file || importing}>
            {t(holidayKinds[kind].importButton)}
          </button>
        </div>
      </form>
      {done !== null && (
        <p className="status status-ok" role="status">
          {t('holidaysImportDone', { count: done })}
        </p>
      )}
      <ProblemAlert problem={problem} />
    </section>
  )
}
