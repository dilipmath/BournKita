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
