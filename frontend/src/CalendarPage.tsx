import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { fetchCalendar, groupIcons, removeEvent, saveEvent, type CalendarEvent, type Occurrence } from './api'
import { addDays, addMonths, dayAndMonth, daysFrom, fullDate, isDay, longDay, monthName, monthWeeks, sameMonth, startOfMonth, startOfWeek, weekdayNames } from './calendarDates'
import { kitaToday } from './dates'
import EventForm from './EventForm'
import { repeatText } from './eventText'
import GroupLabel from './GroupLabel'
import ProblemAlert from './ProblemAlert'
import { useProfileChange } from './profileChange'
import { useGroups } from './useGroups'

type View = 'month' | 'week' | 'agenda'
const views: View[] = ['month', 'week', 'agenda']
const viewLabel = { month: 'viewMonth', week: 'viewWeek', agenda: 'viewAgenda' } as const
// An agenda lists this many days from the day it starts.
const AGENDA_DAYS = 30

/** The days a view shows around `day`, and the day Previous and Next go to. */
function span(view: View, day: string): { first: string; last: string; previous: string; next: string } {
  if (view === 'month') {
    const weeks = monthWeeks(day)
    return { first: weeks[0][0], last: weeks.at(-1)![6], previous: addMonths(day, -1), next: addMonths(day, 1) }
  }
  if (view === 'week') {
    const monday = startOfWeek(day)
    return { first: monday, last: addDays(monday, 6), previous: addDays(monday, -7), next: addDays(monday, 7) }
  }
  return { first: day, last: addDays(day, AGENDA_DAYS - 1), previous: addDays(day, -AGENDA_DAYS), next: addDays(day, AGENDA_DAYS) }
}

/** The occurrences touching `day`. */
function on(occurrences: Occurrence[], day: string): Occurrence[] {
  return occurrences.filter((occurrence) => occurrence.startsOn <= day && day <= occurrence.endsOn)
}

/** "10:00", or "10:00–10:45" with `withEnd`; nothing for an all-day Event. */
function times(event: CalendarEvent, withEnd: boolean): string {
  if (event.startTime === null) return ''
  const start = event.startTime.slice(0, 5)
  return withEnd && event.endTime ? `${start}–${event.endTime.slice(0, 5)}` : start
}

/** Loads what happens from `first` to `last`; `reload` loads it again after a change. */
function useOccurrences(first: string, last: string, groupId: number | null) {
  const [loaded, setLoaded] = useState<{ key: string; occurrences: Occurrence[] | 'failed' }>()
  const [version, setVersion] = useState(0)
  const key = `${first}/${last}/${groupId}`

  useEffect(() => {
    // After moving on, a late answer about the span before must not show.
    let latest = true
    fetchCalendar(first, last, groupId)
      .then((occurrences) => latest && setLoaded({ key, occurrences }))
      .catch(() => latest && setLoaded({ key, occurrences: 'failed' }))
    return () => {
      latest = false
    }
  }, [first, last, groupId, key, version])

  return { occurrences: loaded?.key === key ? loaded.occurrences : undefined, reload: () => setVersion((current) => current + 1) }
}

/** A Calendar of Events: a Group's (its own and the whole Kita's), or, at /calendar, the whole
 * Kita's with every Group's. Month, week and agenda views; Staff add, change and delete Events. */
export default function CalendarPage() {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const params = useParams()
  const groupId = params.id === undefined ? null : Number(params.id)
  const group = useGroups()?.find((listed) => listed.id === groupId)
  // Kept in the address, so Back and a reload keep the view.
  const [search, setSearch] = useSearchParams()
  const view: View = views.includes(search.get('view') as View) ? (search.get('view') as View) : 'month'
  const asked = search.get('day')
  // An address with no day, or one that is not a real day, shows today.
  const day = asked && isDay(asked) ? asked : kitaToday()
  const { first, last, previous, next } = span(view, day)
  // A new Event starts today if today is being looked at; otherwise on the first day shown (in
  // a month view, the first of the month).
  const shownFrom = view === 'month' ? startOfMonth(day) : first
  const shownTo = view === 'month' ? addDays(addMonths(day, 1), -1) : last
  const newEventDay = shownFrom <= kitaToday() && kitaToday() <= shownTo ? kitaToday() : shownFrom
  const { occurrences, reload } = useOccurrences(first, last, groupId)
  // The occurrence whose details are open, or 'new' while an Event is added.
  const [open, setOpen] = useState<Occurrence | 'new' | null>(null)
  const { problem, change } = useProfileChange(reload)

  function go(changes: { view?: View; day?: string }) {
    setSearch({ view: changes.view ?? view, day: changes.day ?? day })
  }

  /** An occurrence to tap for its details. `wide` (week and agenda) shows its end time and its
   * Group's name; a month's narrow days show the Group's icon only, its name for screen readers. */
  function chip(occurrence: Occurrence, wide: boolean) {
    const { event } = occurrence
    const time = times(event, wide)
    return (
      <button key={`${event.id}-${occurrence.startsOn}`} type="button" className="event-chip" onClick={() => setOpen(occurrence)}>
        {event.group && (
          <>
            <span aria-hidden="true">{groupIcons[event.group.icon]} </span>
            <span className={wide ? 'event-group' : 'visually-hidden'}>{event.group.name}: </span>
          </>
        )}
        {time && `${time} `}
        {event.title}
      </button>
    )
  }

  function dayList(listed: string, empty: string | null) {
    const here = on(occurrences === 'failed' || occurrences === undefined ? [] : occurrences, listed)
    if (here.length === 0 && empty === null) return null
    const headingId = `day-${listed}`
    return (
      <section key={listed} className={listed === kitaToday() ? 'calendar-day today' : 'calendar-day'} aria-labelledby={headingId}>
        <h4 id={headingId}>{longDay(listed, language)}</h4>
        {here.length === 0 ? <p>{empty}</p> : <div className="event-list">{here.map((occurrence) => chip(occurrence, true))}</div>}
      </section>
    )
  }

  function body() {
    if (occurrences === undefined) return <p>{t('loading')}</p>
    if (occurrences === 'failed') {
      return (
        <p className="status status-problem" role="alert">
          {t('somethingWentWrong')}
        </p>
      )
    }
    if (view === 'month') {
      return (
        <table className="month" aria-label={monthName(day, language)}>
          <thead>
            <tr>
              {weekdayNames(language).map((name) => (
                <th key={name} scope="col">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthWeeks(day).map((week) => (
              <tr key={week[0]}>
                {week.map((cell) => {
                  const classes = ['month-day', !sameMonth(cell, day) && 'other-month', cell === kitaToday() && 'today'].filter(Boolean)
                  return (
                    <td key={cell} className={classes.join(' ')} aria-label={dayAndMonth(cell, language)}>
                      <span className="day-number" aria-hidden="true">
                        {Number(cell.slice(8))}
                      </span>
                      {on(occurrences, cell).map((occurrence) => chip(occurrence, false))}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
    if (view === 'week') return <div className="week">{daysFrom(first, last).map((listed) => dayList(listed, t('nothingOn')))}</div>
    const listed = daysFrom(first, last).filter((agendaDay) => on(occurrences, agendaDay).length > 0)
    return listed.length === 0 ? <p>{t('nothingOnAgenda', { count: AGENDA_DAYS })}</p> : <div className="agenda">{listed.map((agendaDay) => dayList(agendaDay, null))}</div>
  }

  const periodTitle = view === 'month' ? monthName(day, language) : `${dayAndMonth(first, language)} – ${fullDate(last, language)}`

  return (
    <section className="page calendar">
      {groupId !== null && <Link to={`/groups/${groupId}`}>{t('backToGroup')}</Link>}
      <h2>
        {t('calendar')}
        {': '}
        {groupId === null ? t('kitaWideName') : group && <GroupLabel group={group} />}
      </h2>
      <div className="calendar-toolbar">
        <div className="actions" role="group" aria-label={t('calendarView')}>
          {views.map((each) => (
            <button key={each} type="button" aria-pressed={each === view} onClick={() => go({ view: each })}>
              {t(viewLabel[each])}
            </button>
          ))}
        </div>
        <div className="actions">
          <button type="button" onClick={() => go({ day: previous })}>
            {t('previous')}
          </button>
          <button type="button" onClick={() => go({ day: kitaToday() })}>
            {t('today')}
          </button>
          <button type="button" onClick={() => go({ day: next })}>
            {t('next')}
          </button>
        </div>
        <button type="button" className="primary" onClick={() => setOpen('new')}>
          {t('addEvent')}
        </button>
      </div>
      <h3>{periodTitle}</h3>
      {open === 'new' && <ProblemAlert problem={problem} />}
      {open === 'new' && (
        <EventForm
          label={t('addEvent')}
          groupId={groupId}
          day={newEventDay}
          onSave={async (details) => {
            const saved = await change(() => saveEvent(details))
            if (saved) setOpen(null)
            return saved
          }}
          onCancel={() => setOpen(null)}
        />
      )}
      {open !== null && open !== 'new' && (
        <EventDetails
          key={`${open.event.id}-${open.startsOn}`}
          occurrence={open}
          onChanged={() => {
            setOpen(null)
            reload()
          }}
          onClose={() => setOpen(null)}
        />
      )}
      {body()}
    </section>
  )
}

type DetailsProps = { occurrence: Occurrence; onChanged: () => void; onClose: () => void }

/** One occurrence of an Event: when, how it repeats, for whom; Staff change or delete the Event
 * from here (every time it happens, if it repeats). */
function EventDetails({ occurrence, onChanged, onClose }: DetailsProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const { event } = occurrence
  const { problem, change } = useProfileChange(onChanged)
  const [changing, setChanging] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const panel = useRef<HTMLElement>(null)
  const headingId = `event-${event.id}`

  useEffect(() => {
    // Opened by a tap in the Calendar below: bring it into view, for keyboards too.
    panel.current?.focus()
  }, [])

  const when =
    occurrence.startsOn === occurrence.endsOn
      ? [longDay(occurrence.startsOn, language), times(event, true)].filter(Boolean).join(', ')
      : `${longDay(occurrence.startsOn, language)} – ${longDay(occurrence.endsOn, language)}`
  const repeats = repeatText(t, event, event.repeatUntil && fullDate(event.repeatUntil, language))

  return (
    <section className="event-details" aria-labelledby={headingId} tabIndex={-1} ref={panel}>
      <h3 id={headingId}>{event.title}</h3>
      <p>{when}</p>
      {repeats && <p>{repeats}</p>}
      <p>{event.group ? <GroupLabel group={event.group} /> : t('wholeKita')}</p>
      {event.note && <p className="note">{event.note}</p>}
      <ProblemAlert problem={problem} />
      {changing ? (
        <EventForm
          label={t('changeNamed', { name: event.title })}
          event={event}
          groupId={event.group?.id ?? null}
          day={event.startsOn}
          onSave={(details) => change(() => saveEvent(details, event.id))}
          onCancel={() => setChanging(false)}
        />
      ) : confirming ? (
        // A second, deliberate step.
        <div className="confirm" role="group" aria-label={t('deleteNamed', { name: event.title })}>
          <p>{t(event.repeat === 'none' ? 'confirmDeleteEvent' : 'confirmDeleteSeries', { title: event.title })}</p>
          <div className="actions">
            <button type="button" className="danger" onClick={() => void change(() => removeEvent(event.id))}>
              {t('delete')}
            </button>
            <button type="button" autoFocus onClick={() => setConfirming(false)}>
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          <button type="button" aria-label={t('changeNamed', { name: event.title })} onClick={() => setChanging(true)}>
            {t('edit')}
          </button>
          <button type="button" aria-label={t('deleteNamed', { name: event.title })} onClick={() => setConfirming(true)}>
            {t('delete')}
          </button>
          <button type="button" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      )}
    </section>
  )
}
