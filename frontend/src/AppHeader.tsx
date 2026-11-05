import { useTranslation } from 'react-i18next'
import { Link, useMatch } from 'react-router-dom'
import { logOut, type Session } from './api'
import EmergencyListLink from './EmergencyListLink'
import HeaderMenu from './HeaderMenu'
import Icon from './Icon'
import { GroupNavigation, MainNavigation } from './MainNavigation'

const languages = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
] as const

function LanguageChoice() {
  const { t, i18n } = useTranslation()
  return (
    <nav aria-label={t('language')} className="languages">
      {languages.map(({ code, label }) => (
        <button key={code} type="button" lang={code} aria-pressed={i18n.language === code} onClick={() => void i18n.changeLanguage(code)}>
          {label}
        </button>
      ))}
    </nav>
  )
}

/** The Group whose pages are open (its Today view, Tasks or Calendar), or null. */
function useCurrentGroupId(): number | null {
  const match = useMatch('/groups/:id/*')
  const id = Number(match?.params.id)
  return Number.isInteger(id) && id > 0 ? id : null
}

/** The top of every page: the app's name (back to the start page); once someone is logged in, the
 * Emergency button, their account menu (who it is, language, Log out), the pages their Role may
 * open and, inside a Group, the Group's pages. Before that, the language choice. */
export default function AppHeader({ session, onLoggedOut }: { session: Session | null; onLoggedOut: () => void }) {
  const { t } = useTranslation()
  const groupId = useCurrentGroupId()
  const isGuest = session?.role === 'guest'
  const name = session ? (session.displayName ?? session.email) : ''

  return (
    <>
      <header>
        <h1>
          <Link to="/">{t('appName')}</Link>
        </h1>
        {session ? (
          <div className="header-actions">
            {/* Guests never see personal data, so no emergency list. */}
            {!isGuest && (
              <HeaderMenu
                label={
                  <>
                    <Icon name="alert" />
                    {t('emergency')}
                  </>
                }
                className="emergency"
              >
                {groupId !== null && <EmergencyListLink groupId={groupId} />}
                <EmergencyListLink />
              </HeaderMenu>
            )}
            <HeaderMenu label={name} ariaLabel={t('menuFor', { name })}>
              <p>{t('loggedInAs', { name })}</p>
              <LanguageChoice />
              {/* Even when the server cannot be reached, the logged-in view must not stay on screen. */}
              <button type="button" onClick={() => void logOut().catch(() => undefined).finally(onLoggedOut)}>
                {t('logOut')}
              </button>
            </HeaderMenu>
          </div>
        ) : (
          <LanguageChoice />
        )}
      </header>
      {session && <MainNavigation role={session.role} />}
      {session && !isGuest && groupId !== null && <GroupNavigation groupId={groupId} />}
    </>
  )
}
