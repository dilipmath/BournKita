import type { DayCounts } from './DayBar'

/** Several Groups' days added up. */
export function dayOfGroups(groups: DayCounts[]): DayCounts {
  const sum = (part: keyof DayCounts) => groups.reduce((total, group) => total + group[part], 0)
  return { here: sum('here'), gone: sum('gone'), absent: sum('absent'), notYet: sum('notYet') }
}
