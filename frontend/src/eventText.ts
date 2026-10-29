import type { TFunction } from 'i18next'
import type { CalendarEvent, Repeat } from './api'

/** How each kind of repeat is named, e.g. "Every week". */
export const repeatLabel: Record<Repeat, string> = {
  none: 'repeatNone',
  daily: 'repeatDaily',
  weekly: 'repeatWeekly',
  monthly: 'repeatMonthly',
  yearly: 'repeatYearly',
}

/** "Every how many weeks", for each kind of repeat; with "Count" added, e.g. "Every 2 weeks". */
export const everyLabel: Record<Exclude<Repeat, 'none'>, string> = {
  daily: 'repeatEveryDays',
  weekly: 'repeatEveryWeeks',
  monthly: 'repeatEveryMonths',
  yearly: 'repeatEveryYears',
}

/** E.g. "Every week", or "Every 2 weeks, until 15 July 2027" (`until` already formatted);
 * nothing for an Event that does not repeat. */
export function repeatText(t: TFunction, event: CalendarEvent, until: string | null): string {
  if (event.repeat === 'none') return ''
  const every = event.repeatEvery === 1 ? t(repeatLabel[event.repeat]) : t(`${everyLabel[event.repeat]}Count`, { count: event.repeatEvery })
  return until ? t('repeatsUntilDate', { every, date: until }) : every
}

/** The Reminders an Event can ask for, by days before (0: that morning), in the order offered. */
export const reminderLabel: Record<number, string> = {
  0: 'reminderThatMorning',
  1: 'reminderDayBefore',
  2: 'reminderTwoDaysBefore',
  7: 'reminderWeekBefore',
}

/** E.g. "1 day before". */
export function reminderText(t: TFunction, daysBefore: number): string {
  const label = reminderLabel[daysBefore]
  // Only the API's choices are offered; anything else is shown as it is.
  return label ? t(label) : String(daysBefore)
}
