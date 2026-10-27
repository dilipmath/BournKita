// Where the Kita is, which decides what day it is there (as the API decides it too).
const KITA_TIME_ZONE = 'Europe/Berlin'

/** A day as a date field gives it (YYYY-MM-DD), at midnight in the tablet's time zone;
 * `plusDays` moves it. */
export function localDate(date: string, plusDays = 0): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day + plusDays)
}

/** Today at the Kita, as a date field takes it. */
export function kitaToday(): string {
  // Canadian English writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: KITA_TIME_ZONE }).format(new Date())
}
