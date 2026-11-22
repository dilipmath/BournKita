import { useTranslation } from 'react-i18next'
import type { GroupColour } from './api'
import type { DayCounts } from './DayBar'
import Icon from './Icon'

// The dots in the order of the day: here, gone home, absent, still to come.
const parts = ['here', 'gone', 'absent', 'notYet'] as const

type Props = {
  day: DayCounts
  /** Whose Birthday it is today, by name; left out where Needs attention already says it. */
  birthdays?: string[]
  /** One Group's: its dots in its colour. */
  colour?: GroupColour
}

/** The day at a glance: how many Children are here, one dot per Child (filled, faded, striped or
 * dashed, so the state never rests on colour), the other counts and today's Birthdays. */
export default function SummaryStrip({ day, birthdays = [], colour }: Props) {
  const { t } = useTranslation()
  const total = day.here + day.gone + day.absent + day.notYet
  return (
    <section className={colour ? `summary-strip group-colour-${colour}` : 'summary-strip'} aria-label={t('todayInNumbers')}>
      <p className="summary-count">
        <span className="summary-number">{day.here}</span> <span>{t('summaryOf', { count: day.here, total })}</span>
      </p>
      <span className="summary-dots" role="img" aria-label={t('dayInNumbersSentence', { ...day, total })}>
        {parts.flatMap((part) => Array.from({ length: day[part] }, (_, index) => <span key={`${part}-${index}`} className={`summary-dot ${part}`} />))}
      </span>
      <ul className="summary-counts">
        <li>
          <b>{day.notYet}</b> {t('summaryNotYet')}
        </li>
        <li>
          <b>{day.absent}</b> {t('summaryAbsent')}
        </li>
        <li>
          <b>{day.gone}</b> {t('summaryGone')}
        </li>
      </ul>
      {birthdays.length > 0 && (
        <p className="summary-birthdays">
          <Icon name="birthday" />
          {t('birthdayToday', { names: birthdays.join(', ') })}
        </p>
      )}
    </section>
  )
}
