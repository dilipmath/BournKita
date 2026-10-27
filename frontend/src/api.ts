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
  mail_not_sent: 'mailNotSent',
  not_found: 'notFound',
  name_required: 'nameRequired',
  too_long: 'tooLong',
  already_given: 'alreadyGiven',
  not_given: 'notGiven',
  in_future: 'inFuture',
  out_of_order: 'outOfOrder',
} as const

export type Refusal = (typeof refusals)[keyof typeof refusals]

/** The refusal an error response stands for; throws for any other failure. */
async function refusalOf(response: Response, action: string): Promise<Refusal> {
  const { detail } = (await response.json().catch(() => ({}))) as { detail?: string }
  const refusal = detail && detail in refusals ? refusals[detail as keyof typeof refusals] : undefined
  if (!refusal) throw new Error(`${action} failed: ${response.status}`)
  return refusal
}

/** Logs in; resolves to 'invalidCredentials' when the email address or password is wrong, or the
 * account is locked after too many failed logins (the API does not tell these apart). */
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

// emailSent is false when the account exists but its verification email could not be sent.
export type CreatedStaffAccount = StaffAccount & { emailSent: boolean }

/** Creates an invited account; the API emails a link for choosing a password. */
export async function createStaffMember(email: string, role: Role): Promise<CreatedStaffAccount | Refusal> {
  const response = await sendJson('/api/staff', 'POST', { email, role })
  if (!response.ok) return refusalOf(response, 'Creating the account')
  return (await response.json()) as CreatedStaffAccount
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

/** Sets the password from the verification email's link, which also verifies the address.
 * Resolves to true once saved. */
export async function verifyEmail(token: string, password: string): Promise<true | Refusal> {
  const response = await sendJson('/api/email-verifications', 'POST', { token, password })
  if (!response.ok) return refusalOf(response, 'Verifying the email address')
  return true
}

/** Asks for a password reset link. The API answers the same whether or not the address has an
 * account, so this only fails when the API cannot be reached. */
export async function requestPasswordReset(email: string): Promise<void> {
  const response = await sendJson('/api/password-resets', 'POST', { email })
  if (!response.ok) throw new Error(`Requesting a password reset failed: ${response.status}`)
}

/** Sets a new password from the reset email's link. Resolves to true once saved. */
export async function resetPassword(token: string, password: string): Promise<true | Refusal> {
  const response = await sendJson('/api/password-resets', 'PUT', { token, password })
  if (!response.ok) return refusalOf(response, 'Resetting the password')
  return true
}

export type Gender = 'girl' | 'boy' | 'diverse'
// Each Gender's translation key.
export const genderLabel = { girl: 'genderGirl', boy: 'genderBoy', diverse: 'genderDiverse' } as const
// A Child as the list shows it: the name only.
export type ChildSummary = { id: number; firstName: string; lastName: string }
// What an Admin enters for a Child profile; gender is null when not stated.
export type ChildDetails = {
  firstName: string
  lastName: string
  gender: Gender | null
  languages: string
  foodPreferences: string
  interests: string
}
export type Child = ChildDetails & { id: number }
// Each Child profile field's translation key where it differs from the field's name, e.g. for
// the audit log's changed fields (others, like parentAddress, are translated by their name).
export const childFieldLabel: Record<keyof ChildDetails, string> = {
  firstName: 'firstName',
  lastName: 'lastName',
  gender: 'gender',
  languages: 'languagesSpoken',
  foodPreferences: 'foodPreferences',
  interests: 'interests',
}

/** The Children, by first name; `search` keeps those whose name contains it. */
export async function fetchChildren(search: string): Promise<ChildSummary[]> {
  const response = await fetch(`/api/children?search=${encodeURIComponent(search)}`)
  if (!response.ok) throw new Error(`Loading the Children failed: ${response.status}`)
  return (await response.json()) as ChildSummary[]
}

// The whole profile, as its page shows it.
export type ChildProfile = Child & {
  parents: LinkedParent[]
  emergencyContacts: Contact[]
  pickUpPersons: Contact[]
  consents: Consents
}

/** A Child profile, or null when none has this ID (e.g. it was deleted). */
export async function fetchChild(id: number): Promise<ChildProfile | null> {
  const response = await fetch(`/api/children/${id}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Loading the Child profile failed: ${response.status}`)
  return (await response.json()) as ChildProfile
}

/** Creates a Child profile, or changes the one with `id`. Admins only. */
export async function saveChild(details: ChildDetails, id?: number): Promise<Child | Refusal> {
  const response =
    id === undefined ? await sendJson('/api/children', 'POST', details) : await sendJson(`/api/children/${id}`, 'PUT', details)
  if (!response.ok) return refusalOf(response, 'Saving the Child profile')
  return (await response.json()) as Child
}

/** Deletes a Child profile for good. Admins only. Resolves to true once deleted. */
export async function deleteChild(id: number): Promise<true | Refusal> {
  const response = await fetch(`/api/children/${id}`, { method: 'DELETE' })
  if (!response.ok) return refusalOf(response, 'Deleting the Child profile')
  return true
}

export type AuditAction = 'viewed' | 'created' | 'changed' | 'deleted'
// Who did what to which Child, and when; childName is null once the profile is deleted.
export type AuditEntry = {
  id: number
  at: string
  staffEmail: string
  action: AuditAction
  childId: number
  childName: string | null
  changedFields: string[]
}
// Which entries to show; since and until are instants (ISO), until not included.
export type AuditFilter = {
  childId?: number
  staffEmail?: string
  action?: AuditAction
  since?: string
  until?: string
}
export const AUDIT_PAGE_SIZE = 50

/** A page of the audit log, newest first; `before` continues after the entry with that ID.
 * Resolves to 'adminsOnly' for anyone but an Admin. */
export async function fetchAuditLog(filter: AuditFilter, before?: number): Promise<AuditEntry[] | Refusal> {
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries({ ...filter, before, limit: AUDIT_PAGE_SIZE })) {
    if (value !== undefined) params.set(name, String(value))
  }
  const response = await fetch(`/api/audit-log?${params}`)
  if (!response.ok) return refusalOf(response, 'Loading the audit log')
  return (await response.json()) as AuditEntry[]
}

// A Parent: a contact person recorded for one or more Children, not a login. Only names are required.
export type ParentDetails = { firstName: string; lastName: string; address: string; phone: string; email: string }
export type Parent = ParentDetails & { id: number }
export type ParentSummary = { id: number; firstName: string; lastName: string }
export type ParentWithChildren = Parent & { children: ChildSummary[] }

/** Recorded Parents whose name contains `search`, e.g. to link a Sibling's Parent. */
export async function searchParents(search: string): Promise<ParentSummary[]> {
  const response = await fetch(`/api/parents?search=${encodeURIComponent(search)}`)
  if (!response.ok) throw new Error(`Searching Parents failed: ${response.status}`)
  return (await response.json()) as ParentSummary[]
}

/** A Parent with their Children, or null when none has this ID. */
export async function fetchParent(id: number): Promise<ParentWithChildren | null> {
  const response = await fetch(`/api/parents/${id}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Loading the Parent failed: ${response.status}`)
  return (await response.json()) as ParentWithChildren
}

/** Records a Parent, or changes the one with `id`. Admins only. */
export async function saveParent(details: ParentDetails, id?: number): Promise<Parent | Refusal> {
  const response =
    id === undefined ? await sendJson('/api/parents', 'POST', details) : await sendJson(`/api/parents/${id}`, 'PUT', details)
  if (!response.ok) return refusalOf(response, 'Saving the Parent')
  return (await response.json()) as Parent
}

async function changeLink(childId: number, parentId: number, method: 'PUT' | 'DELETE', action: string, body?: object) {
  const url = `/api/children/${childId}/parents/${parentId}`
  const response = body ? await sendJson(url, 'PUT', body) : await fetch(url, { method })
  if (!response.ok) return refusalOf(response, action)
  return true as const
}

/** Links a Parent to a Child. Admins only. Resolves to true once linked. */
export function linkParent(childId: number, parentId: number): Promise<true | Refusal> {
  return changeLink(childId, parentId, 'PUT', 'Linking the Parent')
}

/** Removes a Parent from a Child; the Parent's record stays. Admins only. */
export function unlinkParent(childId: number, parentId: number): Promise<true | Refusal> {
  return changeLink(childId, parentId, 'DELETE', 'Removing the Parent')
}

// A Parent as linked to one Child: whether they may pick that Child up.
export type LinkedParent = Parent & { mayPickUp: boolean }

/** Says whether a linked Parent may pick the Child up. Admins only. */
export function setMayPickUp(childId: number, parentId: number, mayPickUp: boolean): Promise<true | Refusal> {
  return changeLink(childId, parentId, 'PUT', 'Changing who may pick up', { mayPickUp })
}

// A Child's contacts. emergency: whom to call when something happens (Emergency contacts).
// pickUp: who else may take the Child home (Pick-up persons).
export type ContactKind = 'emergency' | 'pickUp'
export type ContactDetails = { kind: ContactKind; name: string; relationship: string; phone: string; note: string }
export type Contact = Omit<ContactDetails, 'kind'> & { id: number }

/** Adds an emergency contact or pick-up person to a Child. Admins only. */
export async function addContact(childId: number, details: ContactDetails): Promise<Contact | Refusal> {
  const response = await sendJson(`/api/children/${childId}/contacts`, 'POST', details)
  if (!response.ok) return refusalOf(response, 'Adding the contact')
  return (await response.json()) as Contact
}

/** Changes one of a Child's contacts. Admins only. */
export async function updateContact(childId: number, contactId: number, details: ContactDetails): Promise<Contact | Refusal> {
  const response = await sendJson(`/api/children/${childId}/contacts/${contactId}`, 'PUT', details)
  if (!response.ok) return refusalOf(response, 'Changing the contact')
  return (await response.json()) as Contact
}

/** Removes one of a Child's contacts. Admins only. Resolves to true once removed. */
export async function removeContact(childId: number, contactId: number): Promise<true | Refusal> {
  const response = await fetch(`/api/children/${childId}/contacts/${contactId}`, { method: 'DELETE' })
  if (!response.ok) return refusalOf(response, 'Removing the contact')
  return true
}

// What a Child's Parents allowed. Each period was given on a date (YYYY-MM-DD) and maybe
// withdrawn on a later one.
export type ConsentType = 'photo' | 'excursion' | 'dataProtection'
export type ConsentPeriod = { givenOn: string; withdrawnOn: string | null }
// Every period of each Consent, oldest first; the last one is the current status.
export type Consents = Record<ConsentType, ConsentPeriod[]>
export type ConsentChange = 'given' | 'withdrawn'

/** Records that a Consent was given or withdrawn on a date. Admins only. Resolves to true once
 * recorded. */
export async function recordConsent(
  childId: number,
  consent: ConsentType,
  change: ConsentChange,
  on: string,
): Promise<true | Refusal> {
  const body = change === 'given' ? { givenOn: on } : { withdrawnOn: on }
  const response = await sendJson(`/api/children/${childId}/consents/${consent}/${change}`, 'POST', body)
  if (!response.ok) return refusalOf(response, 'Recording the Consent')
  return true
}
