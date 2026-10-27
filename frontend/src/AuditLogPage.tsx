import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AUDIT_PAGE_SIZE,
  childFieldLabel,
  fetchAuditLog,
  type AuditAction,
  type AuditEntry,
  type AuditFilter,
  type Refusal,
} from './api'

const actionLabel = {
  viewed: 'actionViewed',
  created: 'actionCreated',
  changed: 'actionChanged',
  deleted: 'actionDeleted',
} as const

/** Midnight at the start of a day picked in a date field, in the tablet's time zone. */
function startOfDay(date: string, plusDays = 0): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day + plusDays).toISOString()
}

/** The Admin-only audit log: who viewed or changed which Child's data, newest first. */
export default function AuditLogPage() {
  const { t, i18n } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  // Set when opened from a Child profile.
  const childId = searchParams.get('child') ? Number(searchParams.get('child')) : undefined
  const [staffEmail, setStaffEmail] = useState('')
  const [action, setAction] = useState<AuditAction | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [applied, setApplied] = useState<Omit<AuditFilter, 'childId'>>({})
  const [entries, setEntries] = useState<AuditEntry[] | undefined>(undefined)
  const [hasOlder, setHasOlder] = useState(false)
  const [problem, setProblem] = useState<Refusal | 'somethingWentWrong' | null>(null)

  const filter = useMemo<AuditFilter>(() => ({ childId, ...applied }), [childId, applied])

  // Shows a page of entries, after `olderThan` when it continues them. Only uses state setters,
  // so it never changes.
  const show = useCallback((page: AuditEntry[] | Refusal, olderThan: AuditEntry[] = []) => {
    if (typeof page === 'string') return setProblem(page)
    setProblem(null)
    setEntries([...olderThan, ...page])
    setHasOlder(page.length === AUDIT_PAGE_SIZE)
  }, [])

  useEffect(() => {
    // Only the answer for the latest filter counts.
    let latest = true
    fetchAuditLog(filter)
      .then((page) => latest && show(page))
      .catch(() => latest && setProblem('somethingWentWrong'))
    return () => {
      latest = false
    }
  }, [filter, show])

  // The filter shown right now, so a late page for an earlier filter can be dropped.
  const currentFilter = useRef(filter)
  useEffect(() => {
    currentFilter.current = filter
  }, [filter])

  async function showOlder(shown: AuditEntry[]) {
    const olderFor = filter
    try {
      const page = await fetchAuditLog(olderFor, shown[shown.length - 1].id)
      if (currentFilter.current === olderFor) show(page, shown)
    } catch {
      setProblem('somethingWentWrong')
    }
  }

  function applyFilter(event: FormEvent) {
    event.preventDefault()
    setApplied({
      staffEmail: staffEmail.trim() || undefined,
      action: action || undefined,
      since: from ? startOfDay(from) : undefined,
      // The whole "to" day counts, so up to the midnight after it.
      until: to ? startOfDay(to, 1) : undefined,
    })
  }

  const time = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
  // Named by any entry about the Child; without one (e.g. none yet), by its number.
  const childName = entries?.find((entry) => entry.childName)?.childName ?? t('childNumber', { id: childId })

  return (
    <section className="audit-log">
      <h2>{t('auditLog')}</h2>
      {childId !== undefined && (
        <p>
          {t('onlyChild', { name: childName })}{' '}
          <button type="button" onClick={() => setSearchParams({})}>
            {t('showAllChildren')}
          </button>
        </p>
      )}
      <form className="audit-filter" onSubmit={applyFilter}>
        <label>
          {t('staffMember')}
          <input type="email" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} />
        </label>
        <label>
          {t('action')}
          <select value={action} onChange={(event) => setAction(event.target.value as AuditAction | '')}>
            <option value="">{t('allActions')}</option>
            {(Object.keys(actionLabel) as AuditAction[]).map((option) => (
              <option key={option} value={option}>
                {t(actionLabel[option])}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('from')}
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          {t('to')}
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button type="submit" className="primary">
          {t('filter')}
        </button>
      </form>
      {problem && (
        <p className="status status-problem" role="alert">
          {t(problem)}
        </p>
      )}
      {entries === undefined ? (
        !problem && <p>{t('loading')}</p>
      ) : entries.length === 0 ? (
        <p>{t('noAuditEntries')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t('when')}</th>
              <th scope="col">{t('staffMember')}</th>
              <th scope="col">{t('action')}</th>
              <th scope="col">{t('child')}</th>
              <th scope="col">{t('whatChanged')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{time.format(new Date(entry.at))}</td>
                <td className="email">{entry.staffEmail}</td>
                <td>{t(actionLabel[entry.action])}</td>
                <td>
                  {entry.childName ? (
                    <Link to={`/children/${entry.childId}`}>{entry.childName}</Link>
                  ) : (
                    t('deletedChild', { id: entry.childId })
                  )}
                </td>
                <td>{entry.changedFields.map((field) => t(childFieldLabel[field as keyof typeof childFieldLabel] ?? field)).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {hasOlder && entries && (
        <button type="button" onClick={() => void showOlder(entries)}>
          {t('showOlderEntries')}
        </button>
      )}
    </section>
  )
}
