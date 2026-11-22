import { useId, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { Session } from './api'
import AttendanceDemo from './AttendanceDemo'
import { greeting } from './greeting'
import Icon from './Icon'
import LanguageChoice from './LanguageChoice'
import LoginForm from './LoginForm'
import { loginFormId } from './LoginLink'
import NameTag from './NameTag'
import { railTags } from './landingExamples'
import { landingSectionIds } from './landingSections'
import TableRegion from './TableRegion'

const chips = [
  { text: 'heroChipNetwork', icon: 'server' },
  { text: 'heroChipTablets', icon: 'tablet' },
  { text: 'heroChipLanguages', icon: 'globe' },
] as const

// What the app does, beside the demo: only what it really has.
const features = [
  { name: 'featureGroup', text: 'featureGroupText', icon: 'children' },
  { name: 'featureAllergies', text: 'featureAllergiesText', icon: 'alert', allergy: true },
  { name: 'featurePickUp', text: 'featurePickUpText', icon: 'safety' },
  { name: 'featurePlanning', text: 'featurePlanningText', icon: 'calendar' },
  { name: 'featureFeedback', text: 'featureFeedbackText', icon: 'feedback' },
] as const

// A Kita day, in order: the times are the markers, because it is a sequence.
const moments = [
  { time: '07:30', name: 'momentArrival', text: 'momentArrivalText', dot: 'var(--g-orange-accent)' },
  { time: '09:00', name: 'momentCircle', text: 'momentCircleText', dot: 'var(--g-lilac-accent)' },
  { time: '11:45', name: 'momentLunch', text: 'momentLunchText', dot: 'var(--g-blue-accent)' },
  { time: '13:00', name: 'momentNap', text: 'momentNapText', dot: 'var(--g-green-accent)' },
  { time: '15:30', name: 'momentPickUp', text: 'momentPickUpText', dot: 'var(--sun)' },
] as const

type Allowed = 'yes' | 'no' | 'kitaWideOnly'
// What each Role may do, as the server enforces it: Admin, Teacher, Guest.
const permissions: { task: string; allowed: [Allowed, Allowed, Allowed] }[] = [
  { task: 'permissionViewProfiles', allowed: ['yes', 'yes', 'no'] },
  { task: 'permissionChangeProfiles', allowed: ['yes', 'no', 'no'] },
  { task: 'permissionAttendance', allowed: ['yes', 'yes', 'no'] },
  { task: 'permissionIncidents', allowed: ['yes', 'yes', 'no'] },
  { task: 'permissionTasks', allowed: ['yes', 'yes', 'no'] },
  { task: 'permissionEvents', allowed: ['yes', 'yes', 'no'] },
  { task: 'permissionCalendar', allowed: ['yes', 'yes', 'kitaWideOnly'] },
  { task: 'permissionManage', allowed: ['yes', 'no', 'no'] },
]
// Each promise checked true of the app: the server, the CSP ('self' only), the Archive's Purge and
// the Audit log.
const promises = [
  { name: 'promiseServer', text: 'promiseServerText', icon: 'server' },
  { name: 'promiseNoTrackers', text: 'promiseNoTrackersText', icon: 'safety' },
  { name: 'promiseArchive', text: 'promiseArchiveText', icon: 'archive' },
  { name: 'promiseAuditLog', text: 'promiseAuditLogText', icon: 'log' },
] as const

const allowedClass = { yes: 'yes', no: 'no', kitaWideOnly: 'part' } as const

/** What anyone sees before logging in: the chalkboard hero with its promise and the login, then
 * how BournKita helps through the day. Only invented examples, never the Kita's own data. */
export default function LandingPage({ onLoggedIn }: { onLoggedIn: (session: Session) => void }) {
  const { t } = useTranslation()
  const heroId = useId()
  const greetingId = useId()
  const attendanceId = useId()
  const dayId = useId()
  const rolesId = useId()
  const privacyId = useId()
  // Read once: the year on the footer doesn't change while the page is open.
  const [year] = useState(() => new Date().getFullYear())
  return (
    <div className="landing">
      <section className="landing-hero" aria-labelledby={heroId}>
        {/* Decoration: the cloakroom rail with its name tags, settling onto it once. */}
        <div className="landing-rail" aria-hidden="true">
          <ul className="landing-rail-tags">
            {railTags.map((tag, index) => (
              <li key={tag.name} style={{ '--i': index } as CSSProperties}>
                <NameTag {...tag} />
              </li>
            ))}
          </ul>
        </div>
        <div className="landing-hero-grid">
          <h2 id={heroId} className="landing-headline">
            {t('heroHeadline')}
          </h2>
          <div className="landing-login-tag">
            <span className="tag-hole" aria-hidden="true" />
            <LoginForm
              id={loginFormId}
              greeting={
                <h2 id={greetingId} className="login-greeting">
                  {t(greeting())}
                </h2>
              }
              onLoggedIn={onLoggedIn}
            />
          </div>
          <div className="landing-hero-more">
            <p className="landing-lead">{t('heroLead')}</p>
            <ul className="landing-chips">
              {chips.map(({ text, icon }) => (
                <li key={text}>
                  <Icon name={icon} />
                  {t(text)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section id={landingSectionIds.attendance} className="landing-section" aria-labelledby={attendanceId}>
        <h2 id={attendanceId}>{t('landingAttendance')}</h2>
        <p className="landing-sub">{t('landingAttendanceSub')}</p>
        <div className="landing-try">
          <AttendanceDemo />
          <ul className="landing-features">
            {features.map(({ name, text, icon, ...feature }) => (
              <li key={name} className={'allergy' in feature ? 'landing-allergies' : undefined}>
                <Icon name={icon} />
                <div>
                  <h3>{t(name)}</h3>
                  <p>{t(text)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section id={landingSectionIds.day} className="landing-section landing-day" aria-labelledby={dayId}>
        <h2 id={dayId}>{t('landingDay')}</h2>
        <p className="landing-sub">{t('landingDaySub')}</p>
        <ol className="landing-timeline">
          {moments.map(({ time, name, text, dot }) => (
            <li key={name}>
              <time dateTime={time}>{time}</time>
              <span className="landing-dot" style={{ '--dot': dot } as CSSProperties} aria-hidden="true" />
              <div>
                <h3>{t(name)}</h3>
                <p>{t(text)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section id={landingSectionIds.roles} className="landing-section landing-roles" aria-labelledby={rolesId}>
        <h2 id={rolesId}>{t('landingRoles')}</h2>
        <p className="landing-sub">{t('landingRolesSub')}</p>
        <TableRegion label={t('landingRoles')}>
          <table>
            <caption className="visually-hidden">{t('permissionsCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('permissionTask')}</th>
                <th scope="col">{t('roleAdmin')}</th>
                <th scope="col">{t('roleTeacher')}</th>
                <th scope="col">{t('roleGuest')}</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map(({ task, allowed }) => (
                <tr key={task}>
                  <th scope="row">{t(task)}</th>
                  {allowed.map((each, index) => (
                    <td key={index} className={allowedClass[each]}>
                      {t(each)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      </section>
      <section id={landingSectionIds.privacy} className="landing-section landing-privacy" aria-labelledby={privacyId}>
        <h2 id={privacyId}>{t('landingPrivacy')}</h2>
        <ul>
          {promises.map(({ name, text, icon }) => (
            <li key={name}>
              <h3>
                <Icon name={icon} />
                {t(name)}
              </h3>
              <p>{t(text)}</p>
            </li>
          ))}
        </ul>
      </section>
      <footer className="landing-footer">
        <span className="landing-footer-name">
          <Icon name="sprout" className="app-mark" />
          {t('appName')}
        </span>
        <LanguageChoice />
        <p>{t('footerCopyright', { year })}</p>
      </footer>
    </div>
  )
}
