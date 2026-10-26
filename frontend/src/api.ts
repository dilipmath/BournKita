export type Health = { status: 'ok' | 'degraded'; database: 'ok' | 'unavailable'; time: string }

export async function fetchHealth(): Promise<Health> {
  const response = await fetch('/api/health')
  // 503 still carries a Health body that says which part is down.
  if (!response.ok && response.status !== 503) throw new Error(`Health check failed: ${response.status}`)
  return (await response.json()) as Health
}

// Who is logged in, and how long the session survives without activity.
export type Session = { email: string; role: 'admin' | 'teacher'; inactivityTimeoutMinutes: number }

/** The current session, or null when nobody is logged in. */
export async function fetchCurrentSession(): Promise<Session | null> {
  const response = await fetch('/api/session')
  if (response.status === 401) return null
  if (!response.ok) throw new Error(`Session check failed: ${response.status}`)
  return (await response.json()) as Session
}

function sendJson(url: string, method: 'POST' | 'PUT', body: object): Promise<Response> {
  return fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

// The API's error codes for refusals the UI explains, mapped to their translation keys.
const refusals = {
  invalid_credentials: 'invalidCredentials',
  admins_only: 'adminsOnly',
  email_taken: 'emailTaken',
  invalid_email: 'invalidEmail',
  last_admin: 'lastAdmin',
  own_account: 'ownAccount',
  not_invited: 'notInvited',
  invalid_link: 'invalidLink',
  password_too_short: 'passwordTooShort',
} as const

export type Refusal = (typeof refusals)[keyof typeof refusals]

/** The refusal an error response stands for; throws for any other failure. */
async function refusalOf(response: Response, action: string): Promise<Refusal> {
  const { detail } = (await response.json().catch(() => ({}))) as { detail?: string }
  const refusal = detail && detail in refusals ? refusals[detail as keyof typeof refusals] : undefined
  if (!refusal) throw new Error(`${action} failed: ${response.status}`)
  return refusal
}

/** Logs in; resolves to 'invalidCredentials' when the email address or password is wrong. */
export async function logIn(email: string, password: string): Promise<Session | Refusal> {
  const response = await sendJson('/api/session', 'POST', { email, password })
  if (!response.ok) return refusalOf(response, 'Login')
  return (await response.json()) as Session
}

export async function logOut(): Promise<void> {
  const response = await fetch('/api/session', { method: 'DELETE' })
  if (!response.ok) throw new Error(`Logout failed: ${response.status}`)
}

export type Role = Session['role']
export type StaffAccount = { id: number; email: string; role: Role; status: 'invited' | 'active' | 'deactivated' }

/** All staff accounts, or 'adminsOnly' when the logged-in Staff member is not an Admin. */
export async function fetchStaffAccounts(): Promise<StaffAccount[] | Refusal> {
  const response = await fetch('/api/staff')
  if (!response.ok) return refusalOf(response, 'Loading staff accounts')
  return (await response.json()) as StaffAccount[]
}

/** Creates an invited account; the API emails a link for choosing a password. */
export async function createStaffMember(email: string, role: Role): Promise<StaffAccount | Refusal> {
  const response = await sendJson('/api/staff', 'POST', { email, role })
  if (!response.ok) return refusalOf(response, 'Creating the account')
  return (await response.json()) as StaffAccount
}

async function changeStaffAccount(id: number, change: 'role' | 'active', body: object): Promise<StaffAccount | Refusal> {
  const response = await sendJson(`/api/staff/${id}/${change}`, 'PUT', body)
  if (!response.ok) return refusalOf(response, 'Changing the account')
  return (await response.json()) as StaffAccount
}

export function changeRole(id: number, role: Role): Promise<StaffAccount | Refusal> {
  return changeStaffAccount(id, 'role', { role })
}

export function setActive(id: number, active: boolean): Promise<StaffAccount | Refusal> {
  return changeStaffAccount(id, 'active', { active })
}

/** Emails an invited Staff member a fresh verification link; earlier links stop working.
 * Resolves to true once sent. */
export async function sendNewLink(id: number): Promise<true | Refusal> {
  const response = await fetch(`/api/staff/${id}/invitation`, { method: 'POST' })
  if (!response.ok) return refusalOf(response, 'Sending a new link')
  return true
}

/** Sets the password from the verification email's link, which also verifies the address. */
export async function verifyEmail(token: string, password: string): Promise<'verified' | Refusal> {
  const response = await sendJson('/api/email-verifications', 'POST', { token, password })
  if (!response.ok) return refusalOf(response, 'Verifying the email address')
  return 'verified'
}
