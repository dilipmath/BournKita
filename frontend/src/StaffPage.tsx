import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  changeRole,
  createStaffMember,
  fetchStaffAccounts,
  sendNewLink,
  setActive,
  type Refusal,
  type Role,
  type StaffAccount,
} from './api'

// What went wrong, as a translation key, with the account concerned where the message names it.
type Problem = { key: Refusal | 'somethingWentWrong' | 'accountCreatedEmailNotSent'; email?: string } | null

const roles: Role[] = ['admin', 'teacher']
const roleLabel = { admin: 'roleAdmin', teacher: 'roleTeacher' } as const
const statusLabel = { invited: 'statusInvited', active: 'statusActive', deactivated: 'statusDeactivated' } as const

function RoleOptions() {
  const { t } = useTranslation()
  return roles.map((option) => (
    <option key={option} value={option}>
      {t(roleLabel[option])}
    </option>
  ))
}

/** The Admin-only page listing every login, where Admins create Staff members and change accounts. */
export default function StaffPage() {
  const { t } = useTranslation()
  const [accounts, setAccounts] = useState<StaffAccount[] | 'adminsOnly' | undefined>(undefined)
  const [problem, setProblem] = useState<Problem>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('teacher')

  useEffect(() => {
    fetchStaffAccounts()
      .then((result) => (result === 'adminsOnly' || Array.isArray(result) ? setAccounts(result) : setProblem({ key: result })))
      .catch(() => setProblem({ key: 'somethingWentWrong' }))
  }, [])

  /** Runs an API call; a refusal is shown, and losing Admin rights (e.g. after demoting
   * oneself) replaces the page with the Admins-only notice. Resolves to the result, or null. */
  async function run<T>(call: () => Promise<T | Refusal>): Promise<T | null> {
    setProblem(null)
    setNotice(null)
    try {
      const result = await call()
      if (result === 'adminsOnly') setAccounts('adminsOnly')
      else if (typeof result === 'string') setProblem({ key: result as Refusal })
      else return result
    } catch {
      setProblem({ key: 'somethingWentWrong' })
    }
    return null
  }

  async function applyAccountChange<T extends StaffAccount>(call: () => Promise<T | Refusal>) {
    const changed = await run(call)
    if (changed) {
      setAccounts((current) => {
        const others = Array.isArray(current) ? current.filter((account) => account.id !== changed.id) : []
        return [...others, changed].sort((a, b) => a.email.localeCompare(b.email))
      })
    }
    return changed
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    const created = await applyAccountChange(() => createStaffMember(email, role))
    if (created) {
      if (created.emailSent) setNotice(t('verificationSent', { email: created.email }))
      else setProblem({ key: 'accountCreatedEmailNotSent', email: created.email })
      setEmail('')
    }
  }

  async function resendLink(account: StaffAccount) {
    if (await run(() => sendNewLink(account.id))) setNotice(t('verificationSent', { email: account.email }))
  }

  if (accounts === 'adminsOnly') {
    return <p className="status status-problem">{t('adminsOnly')}</p>
  }

  return (
    <section className="staff">
      <h2>{t('staffAccounts')}</h2>
      {problem && (
        <p className="status status-problem" role="alert">
          {t(problem.key, { email: problem.email })}
        </p>
      )}
      {notice && (
        <p className="status status-ok" role="status">
          {notice}
        </p>
      )}
      {accounts === undefined ? (
        !problem && <p>{t('loading')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t('emailAddress')}</th>
              <th scope="col">{t('role')}</th>
              <th scope="col">{t('status')}</th>
              <th scope="col">
                <span className="visually-hidden">{t('actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <th scope="row">{account.email}</th>
                <td>
                  <select
                    aria-label={t('role')}
                    value={account.role}
                    onChange={(event) =>
                      void applyAccountChange(() => changeRole(account.id, event.target.value as Role))
                    }
                  >
                    <RoleOptions />
                  </select>
                </td>
                <td>{t(statusLabel[account.status])}</td>
                <td className="actions">
                  {account.status === 'invited' && (
                    <button type="button" onClick={() => void resendLink(account)}>
                      {t('sendNewLink')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      void applyAccountChange(() => setActive(account.id, account.status === 'deactivated'))
                    }
                  >
                    {account.status === 'deactivated' ? t('reactivate') : t('deactivate')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form className="new-staff-member" onSubmit={(event) => void create(event)}>
        <h3>{t('newStaffMember')}</h3>
        <label>
          {t('emailAddress')}
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          {t('newStaffMemberRole')}
          <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <RoleOptions />
          </select>
        </label>
        <button type="submit" className="primary">
          {t('createAccount')}
        </button>
      </form>
    </section>
  )
}
