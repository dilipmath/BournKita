import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { ChildSummary, KitaOverview } from './api'
import Icon, { type IconName } from './Icon'

const fullName = (child: ChildSummary) => `${child.firstName} ${child.lastName}`

/** Links to these Children, separated by commas. */
function ChildLinks({ items, to }: { items: ChildSummary[]; to: (child: ChildSummary) => string }) {
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

/** What needs seeing to today: Children still here after closing time, Children in no Group,
 * today's Incidents; and today's Birthdays, as good news. Left out when there is none. */
export default function NeedsAttention({ overview }: { overview: KitaOverview }) {
  const { t } = useTranslation()
  const headingId = useId()
  const { kita } = overview
  const birthdays = overview.groups.flatMap((group) => group.birthdays)
  const late = kita.stillHereAfterClosing
  if (late.length + kita.withoutGroup.length + kita.incidentsToday + birthdays.length === 0) return null
  // A late Child's Group's Today view, where they are checked out; in no Group, their profile.
  const whereLate = (child: ChildSummary) => {
    const groupId = late.find((each) => each.id === child.id)?.groupId
    return groupId ? `/groups/${groupId}` : `/children/${child.id}`
  }
  return (
    <section className="needs-attention" aria-labelledby={headingId}>
      <h3 id={headingId}>{t('needsAttention')}</h3>
      <ul>
        {late.length > 0 && (
          <Item icon="notYet" tone="warning" title={t('stillHereAfterClosing', { time: kita.closesAt })}>
            <ChildLinks items={late} to={whereLate} />
          </Item>
        )}
        {kita.withoutGroup.length > 0 && (
          <Item icon="children" tone="warning" title={t('inNoGroupTitle')}>
            <ChildLinks items={kita.withoutGroup} to={(child) => `/children/${child.id}`} />
          </Item>
        )}
        {kita.incidentsToday > 0 && (
          <Item icon="incidents" tone="warning" title={t('incidentsTitle')}>
            <Link to="/incidents">{t('incidentsToday', { count: kita.incidentsToday })}</Link>
          </Item>
        )}
        {birthdays.length > 0 && (
          <Item icon="birthday" tone="good" title={t('birthdayTitle')}>
            {birthdays.map(fullName).join(', ')}
          </Item>
        )}
      </ul>
    </section>
  )
}
