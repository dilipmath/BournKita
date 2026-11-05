import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Session } from './api'
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

// Line icons drawn in the text colour; decoration only, so hidden from screen readers.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="login-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

const points = [
  {
    text: 'aboutToday',
    icon: (
      <Icon>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 20c.3-2.6 1.9-4.5 4-4.5 2.2 0 3.5 2 3.5 4.5" />
      </Icon>
    ),
  },
  {
    text: 'aboutSafety',
    icon: (
      <Icon>
        <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </Icon>
    ),
  },
  {
    text: 'aboutPrivacy',
    icon: (
      <Icon>
        <path d="M4 11l8-7 8 7v9H4z" />
        <rect x="9.5" y="13" width="5" height="4" rx="1" />
        <path d="M10.5 13v-1.2a1.5 1.5 0 0 1 3 0V13" />
      </Icon>
    ),
  },
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
export default function LoginPage({ onLoggedIn }: { onLoggedIn: (session: Session) => void }) {
  const { t } = useTranslation()
  const aboutId = useId()
  return (
    <div className="login-page">
      <section className="login-hero">
        <Illustration />
        <h2>{t(greeting())}</h2>
        <p className="login-tagline">{t('loginTagline')}</p>
        <p id={aboutId} className="visually-hidden">
          {t('whatYouFindHere')}
        </p>
        <ul className="login-points" aria-labelledby={aboutId}>
          {points.map(({ text, icon }) => (
            <li key={text}>
              {icon}
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
