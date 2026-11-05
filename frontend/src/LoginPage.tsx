import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { Kita, Session } from './api'
import Icon from './Icon'
import LoginForm from './LoginForm'

/** The hour at the Kita, whatever time zone the tablet is set to. */
function kitaHour(): number {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Berlin' }).format(new Date()))
}

function greeting(): 'goodMorning' | 'goodDay' | 'goodEvening' {
  const hour = kitaHour()
  if (hour < 12) return 'goodMorning'
  return hour < 18 ? 'goodDay' : 'goodEvening'
}

const points = [
  { text: 'aboutToday', icon: 'children' },
  { text: 'aboutSafety', icon: 'safety' },
  { text: 'aboutPrivacy', icon: 'privacy' },
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

/** What a tablet shows before anyone logs in: a friendly welcome, what the app is for, and the
 * login. */
export default function LoginPage({ kita, onLoggedIn }: { kita: Kita; onLoggedIn: (session: Session) => void }) {
  const { t } = useTranslation()
  const aboutId = useId()
  return (
    <div className="login-page">
      <section className="login-hero">
        <Illustration />
        {kita.name && <p className="login-welcome">{t('welcomeTo', { name: kita.name })}</p>}
        <h2>{t(greeting())}</h2>
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
        <LoginForm onLoggedIn={onLoggedIn} />
        <p className="login-help">{t('loginHelp')}</p>
      </div>
    </div>
  )
}
