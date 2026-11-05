import { useTranslation } from 'react-i18next'

export type DayCounts = { here: number; gone: number; absent: number; notYet: number }

// In the order of the day: who is here, who has gone home, who is not coming, who is still to come.
const parts = ['here', 'gone', 'absent', 'notYet'] as const

/** A day in numbers: a bar in up to four parts, each as wide as its share and with its number on
 * it, and the same written out beside it (which is also what a screen reader reads; the bar is
 * decoration). Each part has its own pattern too, so colour is never the only difference. */
export default function DayBar({ day }: { day: DayCounts }) {
  const { t } = useTranslation()
  const total = day.here + day.gone + day.absent + day.notYet
  return (
    <div className="day-bar">
      <div className="day-bar-track" aria-hidden="true">
        {parts
          .filter((part) => day[part] > 0)
          .map((part) => (
            <span key={part} data-part={part} className={`day-bar-part ${part}`} style={{ flexGrow: day[part] }}>
              {day[part]}
            </span>
          ))}
      </div>
      <p className="day-bar-text">{t('dayInNumbers', { ...day, total })}</p>
    </div>
  )
}
