import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { longDay } from './calendarDates'
import { greeting } from './greeting'

type Props = {
  /** Who is logged in: their display name, or their email address without one. */
  name: string
  /** The Kita's day, YYYY-MM-DD. */
  day: string
}

/** The top card after login: a greeting by name and the date. */
export default function DayHeader({ name, day }: Props) {
  const { t, i18n } = useTranslation()
  const headingId = useId()
  return (
    <section className="day-header" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('greetingNamed', { greeting: t(greeting()), name })}</h2>
      <p className="day-header-date">{longDay(day, i18n.language)}</p>
    </section>
  )
}

/** Grey blocks in the shape of a Group's Today view, while it loads. */
export function TodaySkeleton() {
  const { t } = useTranslation()
  return (
    <section className="page dashboard" aria-label={t('loadingToday')} aria-busy="true">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-strip" />
      <div className="board-tags">
        <div className="skeleton skeleton-child" />
        <div className="skeleton skeleton-child" />
        <div className="skeleton skeleton-child" />
      </div>
    </section>
  )
}

/** Grey blocks in the shape of the page, while its numbers load. */
export function StartPageSkeleton() {
  const { t } = useTranslation()
  return (
    <section className="page overview" aria-label={t('loadingToday')} aria-busy="true">
      <div className="skeleton skeleton-header" />
      <div className="group-tiles">
        <div className="skeleton skeleton-tile" />
        <div className="skeleton skeleton-tile" />
      </div>
    </section>
  )
}
