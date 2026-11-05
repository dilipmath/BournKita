/** The hour at the Kita, whatever time zone the tablet is set to. */
function kitaHour(): number {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Berlin' }).format(new Date()))
}

/** The greeting for the time of day at the Kita, as a translation key. */
export function greeting(): 'goodMorning' | 'goodDay' | 'goodEvening' {
  const hour = kitaHour()
  if (hour < 12) return 'goodMorning'
  return hour < 18 ? 'goodDay' : 'goodEvening'
}
