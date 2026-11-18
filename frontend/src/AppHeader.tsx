import { useTranslation } from 'react-i18next'
import { Link, useMatch } from 'react-router-dom'
import { logOut, type Kita, type Session } from './api'
import EmergencyListLink from './EmergencyListLink'
import HeaderMenu from './HeaderMenu'
import LoginLink from './LoginLink'
import { landingSectionIds } from './landingSections'
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

/** The top of every page: BournKita (back to the start page) and the Kita's own name; once someone is logged in, the
 * Emergency button, their account menu (who it is, language, Log out), the pages their Role may
 * open and, inside a Group, the Group's pages. Before that, the language choice. */
type Props = { kita: Kita; session: Session | null; onLanding: boolean; onLoggedOut: () => void }

/** On the Landing page: its parts, and the way to the login. */
function LandingLinks() {
  const { t } = useTranslation()
  return (
    <>
      <nav aria-label={t('onThisPage')} className="landing-links">
        <a href={`#${landingSectionIds.features}`}>{t('navFeatures')}</a>
        <a href={`#${landingSectionIds.why}`}>{t('navWhy')}</a>
        <a href={`#${landingSectionIds.how}`}>{t('navHow')}</a>
      </nav>
      <LoginLink className="button primary">{t('logIn')}</LoginLink>
    </>
  )
}

export default function AppHeader({ kita, session, onLanding, onLoggedOut }: Props) {
  const { t } = useTranslation()
  const groupId = useCurrentGroupId()
  const isGuest = session?.role === 'guest'
  const name = session ? (session.displayName ?? session.email) : ''

  return (
    <>
      <header>
        <div className="header-name">
          <h1>
            <Link to="/">
              <Icon name="sprout" className="app-mark" />
              {t('appName')}
            </Link>
          </h1>
          {/* Whose server this is: the Kita's own name and logo, beside the app's. */}
          {(kita.name || kita.hasLogo) && (
            <p className="header-kita">
              {kita.hasLogo && <img className="kita-logo" src="/api/kita/logo" alt={kita.name ? t('logoOf', { name: kita.name }) : t('kitaLogo')} />}
              {kita.name}
            </p>
          )}
        </div>
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
          <div className="header-actions">
            {onLanding && <LandingLinks />}
            <LanguageChoice />
          </div>
        )}
      </header>
      {session && <MainNavigation role={session.role} />}
      {session && !isGuest && groupId !== null && <GroupNavigation groupId={groupId} />}
    </>
  )
}
