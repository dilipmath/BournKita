import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarEvent, EventDetails, Repeat } from './api'
import GroupOptions from './GroupOptions'
import { useGroups } from './useGroups'
import { everyLabel, repeatLabel } from './eventText'

type Props = {
  /** Names the form, e.g. "Add event". */
  label: string
  event?: CalendarEvent
  /** For a new Event: the Group whose Calendar it is added from (null: the whole Kita's), and
   * the day it starts. */
  groupId: number | null
  day: string
  onSave: (details: EventDetails) => Promise<boolean>
  onCancel: () => void
}

/** Adds an Event or changes one (every time it happens, if it repeats). */
export default function EventForm({ label, event, groupId, day, onSave, onCancel }: Props) {
  const { t } = useTranslation()
  const groups = useGroups()
  const forId = useId()
  const repeatsId = useId()
  const [group, setGroup] = useState(String(event ? (event.group?.id ?? '') : (groupId ?? '')))
  const [title, setTitle] = useState(event?.title ?? '')
  const [note, setNote] = useState(event?.note ?? '')
  const [allDay, setAllDay] = useState(event ? event.startTime === null : true)
  const [startsOn, setStartsOn] = useState(event?.startsOn ?? day)
  const [endsOn, setEndsOn] = useState(event?.endsOn ?? day)
  // Shown as a time field takes them (HH:MM).
  const [startTime, setStartTime] = useState(event?.startTime?.slice(0, 5) ?? '')
  const [endTime, setEndTime] = useState(event?.endTime?.slice(0, 5) ?? '')
  const [repeat, setRepeat] = useState<Repeat>(event?.repeat ?? 'none')
  const [repeatEvery, setRepeatEvery] = useState(String(event?.repeatEvery ?? 1))
  const [repeatUntil, setRepeatUntil] = useState(event?.repeatUntil ?? '')
  const [submitting, setSubmitting] = useState(false)

  /** A new start; an all-day Event's end moves along if it would come before it. */
  function moveStart(day: string) {
    setStartsOn(day)
    if (day && endsOn < day) setEndsOn(day)
  }

  async function submit(submitted: FormEvent) {
    submitted.preventDefault()
    setSubmitting(true)
    const repeats = repeat !== 'none'
    const details: EventDetails = {
      groupId: group ? Number(group) : null,
      title,
      note,
      startsOn,
      // Timed Events are on one day; an all-day one ending before it starts is refused.
      endsOn: allDay ? endsOn || startsOn : startsOn,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      repeat,
      repeatEvery: repeats ? Number(repeatEvery) : 1,
      repeatUntil: repeats && repeatUntil ? repeatUntil : null,
    }
    if (!(await onSave(details))) setSubmitting(false)
  }

  return (
    <form className="contact-form" aria-label={label} onSubmit={(submitted) => void submit(submitted)}>
      <label>
        {t('title')}
        {/* The form opens in place of a button; carry on typing where the tap went. */}
        <input required maxLength={200} autoFocus value={title} onChange={(changed) => setTitle(changed.target.value)} />
      </label>
      {/* Beside the drop-down, not around it, so the picked option does not join its name. */}
      <label htmlFor={forId}>{t('eventFor')}</label>
      <select id={forId} value={group} onChange={(changed) => setGroup(changed.target.value)}>
        <option value="">{t('wholeKita')}</option>
        {/* Until the Groups load, the Event's own keeps the drop-down showing it. */}
        <GroupOptions groups={groups ?? (event?.group ? [event.group] : [])} />
      </select>
      <label className="checkbox">
        <input type="checkbox" checked={allDay} onChange={(changed) => setAllDay(changed.target.checked)} />
        {t('allDay')}
      </label>
      <label>
        {t('startsOn')}
        <input type="date" required value={startsOn} onChange={(changed) => moveStart(changed.target.value)} />
      </label>
      {allDay ? (
        <label>
          {t('endsOn')}
          <input type="date" required min={startsOn} value={endsOn} onChange={(changed) => setEndsOn(changed.target.value)} />
        </label>
      ) : (
        <>
          <label>
            {t('startTime')}
            <input type="time" required value={startTime} onChange={(changed) => setStartTime(changed.target.value)} />
          </label>
          <label>
            {t('endTime')}
            <input type="time" required value={endTime} onChange={(changed) => setEndTime(changed.target.value)} />
          </label>
        </>
      )}
      <label htmlFor={repeatsId}>{t('repeats')}</label>
      <select id={repeatsId} value={repeat} onChange={(changed) => setRepeat(changed.target.value as Repeat)}>
        {(Object.keys(repeatLabel) as Repeat[]).map((kind) => (
          <option key={kind} value={kind}>
            {t(repeatLabel[kind])}
          </option>
        ))}
      </select>
      {repeat !== 'none' && (
        <>
          <label>
            {t(everyLabel[repeat])}
            <input type="number" required min={1} max={99} value={repeatEvery} onChange={(changed) => setRepeatEvery(changed.target.value)} />
          </label>
          <label>
            {t('repeatsUntil')}
            <input type="date" min={startsOn} value={repeatUntil} onChange={(changed) => setRepeatUntil(changed.target.value)} />
          </label>
        </>
      )}
      <label>
        {t('note')}
        <textarea maxLength={2000} value={note} onChange={(changed) => setNote(changed.target.value)} />
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
