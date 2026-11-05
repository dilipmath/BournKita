import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import type { Role } from './api'
import Icon, { type IconName } from './Icon'

// also: further addresses that belong to the entry (e.g. the Admin pages to Administration).
type Entry = { to: string; icon: IconName; label: string; end?: boolean; also?: (path: string) => boolean }

const adminPages = ['/groups', '/staff', '/holidays', '/audit-log', '/archive']

function Links({ entries }: { entries: Entry[] }) {
  const { pathname } = useLocation()
  return entries.map(({ to, icon, label, end, also }) => {
    const current = (end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)) || (also?.(pathname) ?? false)
    return (
      <Link key={to} to={to} className={current ? 'active' : undefined} aria-current={current ? 'page' : undefined}>
        <Icon name={icon} className="nav-icon" />
        {label}
      </Link>
    )
  })
}

/** The pages a Role may open: Home and the Kita-wide pages, plus Administration for Admins. At the
 * bottom of a tablet or phone, down the left of a wide screen. A Guest has the Calendar only. */
export function MainNavigation({ role }: { role: Role }) {
  const { t } = useTranslation()
  const entries: Entry[] =
    role === 'guest'
      ? [{ to: '/calendar', icon: 'calendar', label: t('calendar') }]
      : [
          { to: '/', icon: 'home', label: t('home'), end: true },
          { to: '/children', icon: 'children', label: t('children'), also: (path) => path.startsWith('/parents/') },
          { to: '/calendar', icon: 'calendar', label: t('calendar'), end: true },
          { to: '/incidents', icon: 'incidents', label: t('incidents') },
          ...(role === 'admin'
            ? [{ to: '/administration', icon: 'administration', label: t('administration'), also: (path: string) => adminPages.includes(path) }]
            : []),
        ]
  return (
    <nav className="main-nav" aria-label={t('mainNavigation')}>
      <Links entries={entries} />
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
