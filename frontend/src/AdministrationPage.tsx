import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

const pages = [
  { to: '/groups', label: 'groups', about: 'aboutGroups' },
  { to: '/staff', label: 'staffAccounts', about: 'aboutStaffAccounts' },
  { to: '/holidays', label: 'holidays', about: 'aboutHolidays' },
  { to: '/audit-log', label: 'auditLog', about: 'aboutAuditLog' },
  { to: '/archive', label: 'archive', about: 'aboutArchive' },
] as const

/** The Admins' pages for running the Kita, kept off the daily navigation. */
export default function AdministrationPage() {
  const { t } = useTranslation()
  const headingId = useId()
  return (
    <section className="page administration" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('administration')}</h2>
      <ul>
        {pages.map(({ to, label, about }) => (
          <li key={to}>
            <Link className="button" to={to}>
              {t(label)}
            </Link>
            <p>{t(about)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
