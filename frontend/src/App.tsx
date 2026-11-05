import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Route, Routes } from 'react-router-dom'
import { fetchCurrentSession, fetchHealth, type Session } from './api'
import AddParentPage from './AddParentPage'
import AdministrationPage from './AdministrationPage'
import AppHeader from './AppHeader'
import ArchivePage from './ArchivePage'
import AuditLogPage from './AuditLogPage'
import CalendarPage from './CalendarPage'
import HolidaysPage from './HolidaysPage'
import IncidentLogPage from './IncidentLogPage'
import KitaOverviewPage from './KitaOverviewPage'
import ParentPage, { ParentEditPage } from './ParentPage'
import ChildForm from './ChildForm'
import ChildProfilePage, { ChildEditPage } from './ChildProfilePage'
import ChildrenPage from './ChildrenPage'
import ForgotPasswordPage from './ForgotPasswordPage'
import GroupDashboard from './GroupDashboard'
import FeedbackButton from './FeedbackButton'
import GroupsPage from './GroupsPage'
import BacklogPage from './BacklogPage'
import TaskBoardPage from './TaskBoardPage'
import LoginPage from './LoginPage'
import ResetPasswordPage from './ResetPasswordPage'
import StaffPage from './StaffPage'
import StatusBanner, { type ServerStatus } from './StatusBanner'
import TeacherStartPage from './TeacherStartPage'
import VerifyEmailPage from './VerifyEmailPage'

export default function App() {
  const { t } = useTranslation()

  const [status, setStatus] = useState<ServerStatus>('checking')
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
  const isGuest = session?.role === 'guest'
  const adminsOnly = (message: 'adminsOnly' | 'adminsOnlyAdministration' | 'adminsOnlyChildren' | 'adminsOnlyAuditLog' | 'adminsOnlyArchive' | 'adminsOnlyGroups' | 'adminsOnlyHolidays') => (
    <p className="status status-problem">{t(message)}</p>
  )

  return (
    <main className={session ? 'with-navigation' : undefined}>
      <AppHeader session={session ?? null} onLoggedOut={() => setSession(null)} />
      <StatusBanner status={status} />
      <Routes>
        {/* Opened from an email by someone who has no password yet, so no login needed. */}
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        {/* For whoever cannot log in, so no login needed either. */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={session === null && <LoginPage onLoggedIn={setSession} />} />
      </Routes>
      {session && isGuest && (
        <Routes>
          {/* A Guest sees the Kita-wide calendar only, read-only, whatever the address. */}
          <Route path="*" element={<CalendarPage canImportHolidays={false} readOnly />} />
        </Routes>
      )}
      {session && !isGuest && (
        <Routes>
          <Route
            path="/staff"
            element={
              isAdmin ? <StaffPage /> : adminsOnly('adminsOnly')
            }
          />
          <Route path="/administration" element={isAdmin ? <AdministrationPage /> : adminsOnly('adminsOnlyAdministration')} />
          <Route path="/children" element={<ChildrenPage canEdit={isAdmin} />} />
          <Route path="/children/new" element={isAdmin ? <ChildForm /> : adminsOnly('adminsOnlyChildren')} />
          <Route path="/children/:id" element={<ChildProfilePage canEdit={isAdmin} />} />
          <Route path="/children/:id/edit" element={isAdmin ? <ChildEditPage /> : adminsOnly('adminsOnlyChildren')} />
          <Route path="/children/:id/parents/add" element={isAdmin ? <AddParentPage /> : adminsOnly('adminsOnlyChildren')} />
          <Route path="/parents/:id" element={<ParentPage canEdit={isAdmin} />} />
          <Route path="/parents/:id/edit" element={isAdmin ? <ParentEditPage /> : adminsOnly('adminsOnlyChildren')} />
          <Route path="/audit-log" element={isAdmin ? <AuditLogPage /> : adminsOnly('adminsOnlyAuditLog')} />
          <Route path="/archive" element={isAdmin ? <ArchivePage /> : adminsOnly('adminsOnlyArchive')} />
          <Route path="/groups" element={isAdmin ? <GroupsPage /> : adminsOnly('adminsOnlyGroups')} />
          <Route path="/groups/:id" element={<GroupDashboard />} />
          <Route path="/groups/:id/board" element={<TaskBoardPage />} />
          <Route path="/groups/:id/backlog" element={<BacklogPage />} />
          <Route path="/groups/:id/calendar" element={<CalendarPage canImportHolidays={isAdmin} />} />
          <Route path="/calendar" element={<CalendarPage canImportHolidays={isAdmin} />} />
          <Route path="/holidays" element={isAdmin ? <HolidaysPage /> : adminsOnly('adminsOnlyHolidays')} />
          <Route path="/incidents" element={<IncidentLogPage isAdmin={isAdmin} />} />
          <Route path="/" element={isAdmin ? <KitaOverviewPage /> : <TeacherStartPage />} />
          <Route path="*" element={null} />
        </Routes>
      )}
      {/* On every page, for everyone logged in (Guests too). */}
      {session && <FeedbackButton />}
    </main>
  )
}
