import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import type { Role } from './api'
import Icon, { type IconName } from './Icon'

// also: further addresses that belong to the entry (e.g. the Admin pages to Administration).
type Entry = { to: string; icon: IconName; label: string; end?: boolean; also?: (path: string) => boolean }

const adminPages = ['/groups', '/staff', '/holidays', '/audit-log', '/archive']

/** The entries' links, the open page marked; each in a list item when they make up a list. */
function Links({ entries, listItems = false }: { entries: Entry[]; listItems?: boolean }) {
  const { pathname } = useLocation()
  return entries.map(({ to, icon, label, end, also }) => {
    const current = (end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)) || (also?.(pathname) ?? false)
    const link = (
      <Link key={to} to={to} className={current ? 'active' : undefined} aria-current={current ? 'page' : undefined}>
        <Icon name={icon} className="nav-icon" />
        {label}
      </Link>
    )
    return listItems ? <li key={to}>{link}</li> : link
  })
}

/** One part of the navigation: a heading and its pages, as a list named by the heading. */
function Part({ title, entries }: { title: string; entries: Entry[] }) {
  const titleId = useId()
  return (
    <div className="nav-part">
      <h2 id={titleId} className="nav-part-title">
        {title}
      </h2>
      <ul aria-labelledby={titleId}>
        <Links entries={entries} listItems />
      </ul>
    </div>
  )
}

const roleLabels = { admin: 'roleAdmin', teacher: 'roleTeacher', guest: 'roleGuest' } as const

/** The pages a Role may open, in parts: Daily, Planning and, for Admins, Administration. Down the
 * left on a tablet, along the bottom on a phone; who is logged in, with their Role, at its end. A
 * Guest has the Calendar only. */
export function MainNavigation({ role, name }: { role: Role; name: string }) {
  const { t } = useTranslation()
  const parts: { title: string; entries: Entry[] }[] =
    role === 'guest'
      ? [{ title: t('navPlanning'), entries: [{ to: '/calendar', icon: 'calendar', label: t('calendar') }] }]
      : [
          {
            title: t('navDaily'),
            entries: [
              { to: '/', icon: 'home', label: t('home'), end: true },
              { to: '/children', icon: 'children', label: t('children'), also: (path) => path.startsWith('/parents/') },
              { to: '/incidents', icon: 'incidents', label: t('incidents') },
            ],
          },
          { title: t('navPlanning'), entries: [{ to: '/calendar', icon: 'calendar', label: t('calendar'), end: true }] },
          ...(role === 'admin'
            ? [
                {
                  title: t('administration'),
                  entries: [{ to: '/administration', icon: 'administration', label: t('administration'), also: (path: string) => adminPages.includes(path) } satisfies Entry],
                },
              ]
            : []),
        ]
  return (
    <nav className="main-nav" aria-label={t('mainNavigation')}>
      {parts.map((part) => (
        <Part key={part.title} {...part} />
      ))}
      <p className="nav-who">
        <span className="nav-who-name">{name}</span>
        <span className="nav-who-role">{t(roleLabels[role])}</span>
      </p>
    </nav>
  )
}

/** A Group's own pages, while one of them is open: its Today view, Tasks (with the backlog) and
 * Calendar. */
export function GroupNavigation({ groupId }: { groupId: number }) {
  const { t } = useTranslation()
  const base = `/groups/${groupId}`
  return (
    <nav className="group-nav" aria-label={t('groupViews')}>
      <Links
        entries={[
          { to: base, icon: 'today', label: t('today'), end: true },
          { to: `${base}/board`, icon: 'tasks', label: t('tasks'), also: (path) => path === `${base}/backlog` },
          { to: `${base}/calendar`, icon: 'calendar', label: t('calendar') },
        ]}
      />
    </nav>
  )
}
