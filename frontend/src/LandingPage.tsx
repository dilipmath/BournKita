import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { Kita, Session } from './api'
import { greeting } from './greeting'
import Icon from './Icon'
import LoginForm from './LoginForm'
import LoginLink, { loginFormId } from './LoginLink'
import SampleDay from './SampleDay'
import { landingSectionIds } from './landingSections'

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

const reasons = ['whyOwnServer', 'whyRoles', 'whyArchive', 'whyTablets'] as const

const steps = [
  { name: 'stepSetUp', text: 'stepSetUpText' },
  { name: 'stepChildren', text: 'stepChildrenText' },
  { name: 'stepToday', text: 'stepTodayText' },
] as const

/** What anyone sees before logging in: BournKita's promise, the login card with a greeting, then
 * what the app does, why the data is safe with it and how a Kita gets started. */
export default function LandingPage({ kita, onLoggedIn }: { kita: Kita; onLoggedIn: (session: Session) => void }) {
  const { t } = useTranslation()
  const aboutId = useId()
  const featuresId = useId()
  const startId = useId()
  const whyId = useId()
  const endId = useId()
  const heroId = useId()
  const greetingId = useId()
  return (
    <div className="landing">
      <section className="landing-hero" aria-labelledby={heroId}>
        <div className="landing-hero-text">
          <p className="landing-eyebrow">{t('heroEyebrow')}</p>
          <h2 id={heroId}>
            {t('heroHeadlineFirst')}{' '}
            <span className="landing-headline-line">
              {t('heroHeadlineSecond')} <em>{t('heroHeadlineAccent')}</em>
            </span>
          </h2>
          <p className="landing-hero-lead">{t('heroLead')}</p>
          <div className="landing-actions">
            <LoginLink className="button primary">{t('logIn')}</LoginLink>
            <a className="button" href={`#${landingSectionIds.features}`}>
              {t('exploreFeatures')}
            </a>
          </div>
          <p className="landing-trust">
            <Icon name="children" className="landing-trust-icon" />
            {t('heroTrust')}
          </p>
        </div>
        <SampleDay />
      </section>
      <section className="login-page" aria-labelledby={greetingId}>
        <div className="login-hero">
          {(kita.name || kita.hasLogo) && (
            <p className="login-welcome">
              {kita.hasLogo && <img className="kita-logo" src="/api/kita/logo" alt={kita.name ? t('logoOf', { name: kita.name }) : t('kitaLogo')} />}
              {kita.name && t('welcomeTo', { name: kita.name })}
            </p>
          )}
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
        </div>
        <div className="login-side">
          <LoginForm
            id={loginFormId}
            greeting={
              <h2 id={greetingId} className="login-greeting">
                {t(greeting())}
              </h2>
            }
            onLoggedIn={onLoggedIn}
          />
          <p className="login-help">{t('loginHelp')}</p>
        </div>
      </section>
      <section id={landingSectionIds.features} className="landing-section landing-band" aria-labelledby={featuresId}>
        <div className="landing-center">
          <p className="landing-eyebrow">{t('eyebrowFeatures')}</p>
          <h2 id={featuresId}>{t('landingFeatures')}</h2>
          <p className="landing-lead">{t('landingFeaturesLead')}</p>
        </div>
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
      <section id={landingSectionIds.why} className="landing-section landing-why" aria-labelledby={whyId}>
        <div className="landing-why-mark" aria-hidden="true">
          <span className="landing-bubble" />
          <span className="landing-bubble landing-bubble-small" />
          <Icon name="privacy" className="landing-why-icon" />
          <p className="landing-why-note landing-why-note-one">
            <Icon name="here" />
            {t('whyNoteOne')}
          </p>
          <p className="landing-why-note landing-why-note-two">
            <Icon name="today" />
            {t('whyNoteTwo')}
          </p>
        </div>
        <div>
          <p className="landing-eyebrow">{t('eyebrowWhy')}</p>
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
          <a className="button primary" href={`#${landingSectionIds.how}`}>
            {t('seeHowItWorks')}
          </a>
        </div>
      </section>
      <section id={landingSectionIds.how} className="landing-section landing-band" aria-labelledby={startId}>
        <div className="landing-center">
          <p className="landing-eyebrow">{t('eyebrowHow')}</p>
          <h2 id={startId}>{t('landingStart')}</h2>
          <p className="landing-lead">{t('landingStartLead')}</p>
        </div>
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
        <Icon name="sprout" className="landing-end-icon" />
        <h2 id={endId}>{t('landingEnd')}</h2>
        <p>{t('landingEndText')}</p>
        <LoginLink className="button">{t('backToLogin')}</LoginLink>
      </section>
      <footer className="landing-footer">
        <span className="landing-footer-name">
          <Icon name="sprout" className="app-mark" />
          {t('appName')}
        </span>
        <span>{t('landingFooter')}</span>
        <span>{t('footerCopyright', { year: new Date().getFullYear() })}</span>
      </footer>
    </div>
  )
}
