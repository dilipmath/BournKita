import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { fetchCurrentSession, fetchHealth, logOut, type Session } from './api'
import AddParentPage from './AddParentPage'
import AuditLogPage from './AuditLogPage'
import ParentPage, { ParentEditPage } from './ParentPage'
import ChildForm from './ChildForm'
import ChildProfilePage, { ChildEditPage } from './ChildProfilePage'
import ChildrenPage from './ChildrenPage'
import ForgotPasswordPage from './ForgotPasswordPage'
import GroupDashboard from './GroupDashboard'
import GroupPicker from './GroupPicker'
import GroupsPage from './GroupsPage'
import TaskBoardPage from './TaskBoardPage'
import LoginForm from './LoginForm'
import ResetPasswordPage from './ResetPasswordPage'
import StaffPage from './StaffPage'
import VerifyEmailPage from './VerifyEmailPage'

type Status = 'checking' | 'ok' | 'databaseUnavailable' | 'unreachable'

const languages = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
] as const

export default function App() {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const [status, setStatus] = useState<Status>('checking')
  // undefined while the session is being checked, null when nobody is logged in.
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    fetchHealth()
      .then((health) => setStatus(health.database === 'ok' ? 'ok' : 'databaseUnavailable'))
      .catch(() => setStatus('unreachable'))
  }, [])

  const checkSession = useCallback(() => {
    fetchCurrentSession()
      .then(setSession)
      .catch(() => setSession(null))
  }, [])

  useEffect(() => {
    checkSession()
    // A tablet woken up after the inactivity timeout must show the login again, not stale data.
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkSession()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [checkSession])

  useEffect(() => {
    if (!session) return
    // Ask again once the session could have timed out. If the server has seen no activity since,
    // the answer is "not logged in" and the login form replaces whatever is on screen.
    const timer = window.setTimeout(checkSession, session.inactivityTimeoutMinutes * 60_000 + 5_000)
    return () => window.clearTimeout(timer)
  }, [session, checkSession])

  const isAdmin = session?.role === 'admin'
  const adminsOnly = (message: 'adminsOnly' | 'adminsOnlyChildren' | 'adminsOnlyAuditLog' | 'adminsOnlyGroups') => (
    <p className="status status-problem">{t(message)}</p>
  )

  const statusText = {
    checking: t('checking'),
    ok: t('allWorking'),
    databaseUnavailable: t('databaseUnavailable'),
    unreachable: t('notReachable'),
  }[status]

  return (
    <main>
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
          <p>{t('loggedInAs', { email: session.email })}</p>
          <nav aria-label={t('mainNavigation')}>
            <NavLink to="/" end>
              {t('start')}
            </NavLink>
            <NavLink to="/children">{t('children')}</NavLink>
            {isAdmin && (
              <NavLink to="/groups" end>
                {t('groups')}
              </NavLink>
            )}
            {isAdmin && <NavLink to="/staff">{t('staffAccounts')}</NavLink>}
            {isAdmin && <NavLink to="/audit-log">{t('auditLog')}</NavLink>}
          </nav>
          {/* Even when the server cannot be reached, the logged-in view must not stay on screen. */}
          <button type="button" onClick={() => void logOut().catch(() => undefined).finally(() => setSession(null))}>
            {t('logOut')}
          </button>
        </section>
      )}
      <Routes>
        {/* Opened from an email by someone who has no password yet, so no login needed. */}
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        {/* For whoever cannot log in, so no login needed either. */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={session === null && <LoginForm onLoggedIn={setSession} />} />
      </Routes>
      {session && (
        <Routes>
          <Route
            path="/staff"
            element={
              isAdmin ? <StaffPage /> : adminsOnly('adminsOnly')
            }
          />
          <Route path="/children" element={<ChildrenPage canEdit={isAdmin} />} />
          <Route path="/children/new" element={isAdmin ? <ChildForm /> : adminsOnly('adminsOnlyChildren')} />
          <Route path="/children/:id" element={<ChildProfilePage canEdit={isAdmin} />} />
          <Route path="/children/:id/edit" element={isAdmin ? <ChildEditPage /> : adminsOnly('adminsOnlyChildren')} />
          <Route path="/children/:id/parents/add" element={isAdmin ? <AddParentPage /> : adminsOnly('adminsOnlyChildren')} />
          <Route path="/parents/:id" element={<ParentPage canEdit={isAdmin} />} />
          <Route path="/parents/:id/edit" element={isAdmin ? <ParentEditPage /> : adminsOnly('adminsOnlyChildren')} />
          <Route path="/audit-log" element={isAdmin ? <AuditLogPage /> : adminsOnly('adminsOnlyAuditLog')} />
          <Route path="/groups" element={isAdmin ? <GroupsPage /> : adminsOnly('adminsOnlyGroups')} />
          <Route path="/groups/:id" element={<GroupDashboard />} />
          <Route path="/groups/:id/board" element={<TaskBoardPage />} />
          <Route path="/" element={<GroupPicker />} />
          <Route path="*" element={null} />
        </Routes>
      )}
      {pathname === '/' && (
        <section>
          <h2>{t('systemStatus')}</h2>
          <p className={`status ${status === 'ok' ? 'status-ok' : status === 'checking' ? '' : 'status-problem'}`} role="status">
            {statusText}
          </p>
        </section>
      )}
    </main>
  )
}
