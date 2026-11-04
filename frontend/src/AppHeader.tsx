import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { logOut, type Session } from './api'

const languages = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
] as const

/** The top of every page: the app's name, the language choice and, once someone is logged in,
 * who it is, the pages their Role may open and Log out. */
export default function AppHeader({ session, onLoggedOut }: { session: Session | null; onLoggedOut: () => void }) {
  const { t, i18n } = useTranslation()
  const isAdmin = session?.role === 'admin'
  const isGuest = session?.role === 'guest'

  return (
    <>
      <header>
        <h1>{t('appName')}</h1>
        <nav aria-label={t('language')}>
          {languages.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              lang={code}
              aria-pressed={i18n.language === code}
              onClick={() => void i18n.changeLanguage(code)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      {session && (
        <section className="session">
          <p>{t('loggedInAs', { name: session.displayName ?? session.email })}</p>
          <nav aria-label={t('mainNavigation')}>
            {!isGuest && (
              <NavLink to="/" end>
                {t('start')}
              </NavLink>
            )}
            {!isGuest && <NavLink to="/children">{t('children')}</NavLink>}
            <NavLink to="/calendar">{t('calendar')}</NavLink>
            {!isGuest && <NavLink to="/incidents">{t('incidentLog')}</NavLink>}
            {isAdmin && (
              <NavLink to="/groups" end>
                {t('groups')}
              </NavLink>
            )}
            {isAdmin && <NavLink to="/staff">{t('staffAccounts')}</NavLink>}
            {isAdmin && <NavLink to="/audit-log">{t('auditLog')}</NavLink>}
            {isAdmin && <NavLink to="/archive">{t('archive')}</NavLink>}
          </nav>
          {/* Even when the server cannot be reached, the logged-in view must not stay on screen. */}
          <button type="button" onClick={() => void logOut().catch(() => undefined).finally(onLoggedOut)}>
            {t('logOut')}
          </button>
        </section>
      )}
    </>
  )
}
