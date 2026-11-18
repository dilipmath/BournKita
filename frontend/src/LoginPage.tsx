import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { Kita, Session } from './api'
import { greeting } from './greeting'
import Icon from './Icon'
import LoginForm from './LoginForm'

const points = [
  { text: 'aboutToday', icon: 'children' },
  { text: 'aboutSafety', icon: 'safety' },
  { text: 'aboutPrivacy', icon: 'privacy' },
] as const

// What the app does, one card each: only what it really has.
const features = [
  { name: 'featureToday', text: 'featureTodayText', icon: 'today' },
  { name: 'featureChildren', text: 'featureChildrenText', icon: 'children' },
  { name: 'featureGroups', text: 'featureGroupsText', icon: 'tasks' },
  { name: 'featureCalendar', text: 'featureCalendarText', icon: 'calendar' },
  { name: 'featureIncidents', text: 'featureIncidentsText', icon: 'incidents' },
  { name: 'featureStaff', text: 'featureStaffText', icon: 'person' },
] as const

// The login form's id, for the link back up to it from the end of the page.
const loginFormId = 'login'

const reasons = ['whyOwnServer', 'whyRoles', 'whyArchive', 'whyTablets'] as const

const steps = [
  { name: 'stepSetUp', text: 'stepSetUpText' },
  { name: 'stepChildren', text: 'stepChildrenText' },
  { name: 'stepToday', text: 'stepTodayText' },
] as const

/** A sun over a little house with a path: the Kita, friendly but calm. Decoration only. */
function Illustration() {
  return (
    <svg className="login-illustration" viewBox="0 0 240 150" aria-hidden="true" focusable="false">
      <circle className="sun" cx="190" cy="38" r="20" />
      <path className="hill" d="M0 130c40-30 90-38 130-26s70 6 110-12v58H0z" />
      <path className="house" d="M62 70l34-28 34 28v40H62z" />
      <path className="roof" d="M54 74l42-36 42 36" />
      <rect className="door" x="88" y="86" width="16" height="24" rx="8" />
      <rect className="window" x="70" y="80" width="12" height="12" rx="3" />
      <rect className="window" x="110" y="80" width="12" height="12" rx="3" />
      <circle className="flower" cx="30" cy="118" r="5" />
      <circle className="flower" cx="160" cy="112" r="5" />
      <circle className="flower" cx="210" cy="104" r="5" />
    </svg>
  )
}

/** What a tablet shows before anyone logs in: a friendly welcome and the login, then what the app
 * does, why the data is safe with it and how a Kita gets started. */
export default function LoginPage({ kita, onLoggedIn }: { kita: Kita; onLoggedIn: (session: Session) => void }) {
  const { t } = useTranslation()
  const aboutId = useId()
  const featuresId = useId()
  const startId = useId()
  const whyId = useId()
  const endId = useId()
  return (
    <div className="landing">
      <div className="login-page">
        <section className="login-hero">
          <Illustration />
          {(kita.name || kita.hasLogo) && (
            <p className="login-welcome">
              {kita.hasLogo && <img className="kita-logo" src="/api/kita/logo" alt={kita.name ? t('logoOf', { name: kita.name }) : t('kitaLogo')} />}
              {kita.name && t('welcomeTo', { name: kita.name })}
            </p>
          )}
          <h2>{t(greeting())}</h2>
          <p className="landing-headline">{t('landingHeadline')}</p>
          <p className="login-tagline">{t('loginTagline')}</p>
          <p id={aboutId} className="visually-hidden">
            {t('whatYouFindHere')}
          </p>
          <ul className="login-points" aria-labelledby={aboutId}>
            {points.map(({ text, icon }) => (
              <li key={text}>
                <Icon name={icon} className="login-icon" />
                {t(text)}
              </li>
            ))}
          </ul>
        </section>
        <div className="login-side">
          <LoginForm id={loginFormId} onLoggedIn={onLoggedIn} />
          <p className="login-help">{t('loginHelp')}</p>
        </div>
      </div>
      <section className="landing-section" aria-labelledby={featuresId}>
        <h2 id={featuresId}>{t('landingFeatures')}</h2>
        <p className="landing-lead">{t('landingFeaturesLead')}</p>
        <ul className="landing-features">
          {features.map(({ name, text, icon }) => (
            <li key={name}>
              <Icon name={icon} className="landing-icon" />
              <h3>{t(name)}</h3>
              <p>{t(text)}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="landing-section landing-why" aria-labelledby={whyId}>
        <div className="landing-why-mark" aria-hidden="true">
          <Icon name="privacy" className="landing-why-icon" />
        </div>
        <div>
          <h2 id={whyId}>{t('landingWhy')}</h2>
          <p className="landing-lead">{t('landingWhyLead')}</p>
          <ul className="landing-checklist">
            {reasons.map((reason) => (
              <li key={reason}>
                <Icon name="here" className="landing-check" />
                {t(reason)}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="landing-section" aria-labelledby={startId}>
        <h2 id={startId}>{t('landingStart')}</h2>
        <p className="landing-lead">{t('landingStartLead')}</p>
        <ol className="landing-steps">
          {steps.map(({ name, text }) => (
            <li key={name}>
              <h3>{t(name)}</h3>
              <p>{t(text)}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="landing-end" aria-labelledby={endId}>
        <h2 id={endId}>{t('landingEnd')}</h2>
        <a className="button" href={`#${loginFormId}`}>
          {t('backToLogin')}
        </a>
      </section>
      <p className="landing-footer">{t('landingFooter')}</p>
    </div>
  )
}
