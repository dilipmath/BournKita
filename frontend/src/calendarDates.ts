// Calendar days as a date field gives them (YYYY-MM-DD), counted at midnight UTC so that
// daylight saving time never moves a day.

function toDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`)
}

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(day: string, days: number): string {
  const date = toDate(day)
  date.setUTCDate(date.getUTCDate() + days)
  return toDay(date)
}

/** The first of the month `months` after the one `day` is in. */
export function addMonths(day: string, months: number): string {
  const date = toDate(day)
  return toDay(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)))
}

/** The Monday of the week `day` is in: weeks start on Monday, as in Germany. */
export function startOfWeek(day: string): string {
  return addDays(day, -((toDate(day).getUTCDay() + 6) % 7))
}

/** The days from `first` to `last`, both included. */
export function daysFrom(first: string, last: string): string[] {
  const days: string[] = []
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day)
  return days
}

/** The weeks a month view shows for the month `day` is in: Monday to Sunday, from the week of
 * its first day to the week of its last. */
export function monthWeeks(day: string): string[][] {
  const first = startOfWeek(startOfMonth(day))
  const last = addDays(startOfWeek(addDays(addMonths(day, 1), -1)), 6)
  const days = daysFrom(first, last)
  return Array.from({ length: days.length / 7 }, (_, week) => days.slice(week * 7, week * 7 + 7))
}

export function sameMonth(day: string, other: string): boolean {
  return day.slice(0, 7) === other.slice(0, 7)
}

// British English writes "11 January"; German "11. Januar".
function locale(language: string): string {
  return language.startsWith('de') ? 'de-DE' : 'en-GB'
}

function format(day: string, language: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale(language), { ...options, timeZone: 'UTC' }).format(toDate(day))
}

/** E.g. "January 2027". */
export function monthName(day: string, language: string): string {
  return format(day, language, { month: 'long', year: 'numeric' })
}

/** E.g. "11 January". */
export function dayAndMonth(day: string, language: string): string {
  return format(day, language, { day: 'numeric', month: 'long' })
}

/** E.g. "Monday, 11 January". */
export function longDay(day: string, language: string): string {
  return `${format(day, language, { weekday: 'long' })}, ${dayAndMonth(day, language)}`
}

/** E.g. "15 July 2027". */
export function fullDate(day: string, language: string): string {
  return format(day, language, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** The short weekday names, Monday first, e.g. "Mon". */
export function weekdayNames(language: string): string[] {
  // 4 January 2027 is a Monday.
  return daysFrom('2027-01-04', '2027-01-10').map((day) => format(day, language, { weekday: 'short' }))
}

/** Whether `text` is a real day as a date field gives it (e.g. not "2027-02-31"). */
export function isDay(text: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(toDate(text).getTime()) && toDay(toDate(text)) === text
}

/** The first of the month `day` is in. */
export function startOfMonth(day: string): string {
  return addMonths(day, 0)
}
