import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { ChildSummary, LateChild } from './api'
import Icon, { type IconName } from './Icon'

// Whom a link names: Children by their full name.
type Named = Pick<ChildSummary, 'id' | 'firstName' | 'lastName'>

const fullName = (child: Named) => `${child.firstName} ${child.lastName}`

/** Links to these Children, separated by commas. */
function ChildLinks({ items, to }: { items: Named[]; to: (child: Named) => string }) {
  return items.map((child, index) => (
    <span key={child.id}>
      {index > 0 && ', '}
      <Link to={to(child)}>{fullName(child)}</Link>
    </span>
  ))
}

type ItemProps = { icon: IconName; title: string; tone: 'warning' | 'good'; children: ReactNode }

function Item({ icon, title, tone, children }: ItemProps) {
  const titleId = useId()
  return (
    <li className={`attention-item ${tone}`} aria-labelledby={titleId}>
      <Icon name={icon} />
      <div>
        <strong id={titleId}>{title}</strong>
        <div>{children}</div>
      </div>
    </li>
  )
}

type Props = {
  /** "HH:MM" at the Kita, null without a closing time. */
  closesAt: string | null
  /** Still checked in after closing time. */
  late: LateChild[]
  birthdays: ChildSummary[]
  /** The whole Kita's, on the Kita overview only. */
  withoutGroup?: ChildSummary[]
  incidentsToday?: number
}

/** What needs seeing to today: Children still here after closing time, Children in no Group,
 * today's Incidents; and today's Birthdays, as good news. Left out when there is none. */
export default function NeedsAttention({ closesAt, late, birthdays, withoutGroup = [], incidentsToday = 0 }: Props) {
  const { t } = useTranslation()
  const headingId = useId()
  if (late.length + withoutGroup.length + incidentsToday + birthdays.length === 0) return null
  // A late Child's Group's Today view, where they are checked out; in no Group, their profile.
  const whereLate = (child: Named) => {
    const groupId = late.find((each) => each.id === child.id)?.groupId
    return groupId ? `/groups/${groupId}` : `/children/${child.id}`
  }
  return (
    <section className="needs-attention" aria-labelledby={headingId}>
      <h3 id={headingId}>{t('needsAttention')}</h3>
      <ul>
        {late.length > 0 && (
          <Item icon="notYet" tone="warning" title={t('stillHereAfterClosing', { time: closesAt })}>
            <ChildLinks items={late} to={whereLate} />
          </Item>
        )}
        {withoutGroup.length > 0 && (
          <Item icon="children" tone="warning" title={t('inNoGroupTitle')}>
            <ChildLinks items={withoutGroup} to={(child) => `/children/${child.id}`} />
          </Item>
        )}
        {incidentsToday > 0 && (
          <Item icon="incidents" tone="warning" title={t('incidentsTitle')}>
            <Link to="/incidents">{t('incidentsToday', { count: incidentsToday })}</Link>
          </Item>
        )}
        {birthdays.length > 0 && (
          <Item icon="birthday" tone="good" title={t('birthdayTitle')}>
            <ChildLinks items={birthdays} to={(child) => `/children/${child.id}`} />
          </Item>
        )}
      </ul>
    </section>
  )
}
