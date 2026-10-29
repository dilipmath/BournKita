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
  not_an_image: 'notAnImage',
  too_large: 'photoTooLarge',
  no_photo_consent: 'noPhotoConsent',
  group_name_taken: 'groupNameTaken',
  not_in_group: 'notInGroup',
  backlog_changed: 'backlogChanged',
  ends_before_start: 'endsBeforeStart',
  invalid_times: 'invalidTimes',
  invalid_repeat: 'invalidRepeat',
  invalid_reminder: 'invalidReminder',
  not_a_calendar: 'notACalendar',
  repeating_holidays: 'repeatingHolidays',
  no_holidays: 'noHolidays',
  file_too_large: 'fileTooLarge',
  not_checked_in: 'notCheckedIn',
  already_checked_in: 'alreadyCheckedIn',
  already_checked_out: 'alreadyCheckedOut',
  absent_today: 'absentToday',
  present_then: 'presentThen',
  overlapping_absence: 'overlappingAbsence',
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
// groupIds: the Groups they work in.
export type StaffAccount = {
  id: number
  email: string
  role: Role
  status: 'invited' | 'active' | 'deactivated'
  groupIds: number[]
}

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
  // YYYY-MM-DD, or null when not recorded.
  dateOfBirth: string | null
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
  dateOfBirth: 'dateOfBirth',
}

/** The Children, by first name; `search` keeps those whose name contains it. */
export async function fetchChildren(search: string): Promise<ChildSummary[]> {
  const response = await fetch(`/api/children?search=${encodeURIComponent(search)}`)
  if (!response.ok) throw new Error(`Loading the Children failed: ${response.status}`)
  return (await response.json()) as ChildSummary[]
}

// The whole profile, as its page shows it.
export type ChildProfile = Child & {
  alerts: Alert[]
  // Those that have not ended yet: today's and later ones.
  absences: Absence[]
  parents: LinkedParent[]
  emergencyContacts: Contact[]
  pickUpPersons: Contact[]
  consents: Consents
  // None while the photo Consent is not given.
  photos: Photo[]
  group: Group | null
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
// photoId: their photo's, which changes when the photo does; null without one.
export type LinkedParent = Parent & { mayPickUp: boolean; photoId: number | null }

/** Says whether a linked Parent may pick the Child up. Admins only. */
export function setMayPickUp(childId: number, parentId: number, mayPickUp: boolean): Promise<true | Refusal> {
  return changeLink(childId, parentId, 'PUT', 'Changing who may pick up', { mayPickUp })
}

// A Child's contacts. emergency: whom to call when something happens (Emergency contacts).
// pickUp: who else may take the Child home (Pick-up persons).
export type ContactKind = 'emergency' | 'pickUp'
export type ContactDetails = { kind: ContactKind; name: string; relationship: string; phone: string; note: string }
// photoId: their photo's, which changes when the photo does; null without one.
export type Contact = Omit<ContactDetails, 'kind'> & { id: number; photoId: number | null }

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

// A Child's allergy or medical condition, which every Staff member must know about: what it is
// (e.g. "Peanuts") and, maybe, what to do.
export type AlertKind = 'allergy' | 'medical'
export type AlertDetails = { kind: AlertKind; name: string; note: string }
export type Alert = AlertDetails & { id: number }
export const alertKindLabel = { allergy: 'alertKindAllergy', medical: 'alertKindMedical' } as const

/** Records an allergy or medical condition for a Child. Admins only. */
export async function addAlert(childId: number, details: AlertDetails): Promise<Alert | Refusal> {
  const response = await sendJson(`/api/children/${childId}/alerts`, 'POST', details)
  if (!response.ok) return refusalOf(response, 'Adding the alert')
  return (await response.json()) as Alert
}

/** Changes one of a Child's alerts. Admins only. */
export async function updateAlert(childId: number, alertId: number, details: AlertDetails): Promise<Alert | Refusal> {
  const response = await sendJson(`/api/children/${childId}/alerts/${alertId}`, 'PUT', details)
  if (!response.ok) return refusalOf(response, 'Changing the alert')
  return (await response.json()) as Alert
}

/** Removes one of a Child's alerts. Admins only. Resolves to true once removed. */
export async function removeAlert(childId: number, alertId: number): Promise<true | Refusal> {
  const response = await fetch(`/api/children/${childId}/alerts/${alertId}`, { method: 'DELETE' })
  if (!response.ok) return refusalOf(response, 'Removing the alert')
  return true
}

// What a Child's Parents allowed. Each period was given on a date (YYYY-MM-DD) and maybe
// withdrawn on a later one.
export type ConsentType = 'photo' | 'excursion' | 'dataProtection'
export type ConsentPeriod = { givenOn: string; withdrawnOn: string | null }
// Every period of each Consent, oldest first; the last one is the current status.
export type Consents = Record<ConsentType, ConsentPeriod[]>
export type ConsentChange = 'given' | 'withdrawn'

/** Whether a Consent is given now: its latest period is not withdrawn. */
export function isGiven(periods: ConsentPeriod[]): boolean {
  const current = periods.at(-1)
  return current !== undefined && current.withdrawnOn === null
}

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

// A photo of a Child, for their gallery.
export type Photo = { id: number; uploadedAt: string }
// thumbnail: small, for galleries and lists. full: for looking at one photo.
export type PhotoSize = 'thumbnail' | 'full'
// Whose Pick-up person photo: one of a Child's contacts, or a Parent.
export type PickUpPhoto = { childId: number; contactId: number } | { parentId: number }

export function childPhotoUrl(childId: number, photoId: number, size: PhotoSize): string {
  return `/api/children/${childId}/photos/${photoId}/${size}`
}

function pickUpPhotoBase(of: PickUpPhoto): string {
  return 'parentId' in of ? `/api/parents/${of.parentId}/photo` : `/api/children/${of.childId}/contacts/${of.contactId}/photo`
}

/** Where a Pick-up person's photo is; a new photo gets a new address, so a tablet never shows the one it replaced. */
export function pickUpPhotoUrl(of: PickUpPhoto, photoId: number, size: PhotoSize): string {
  return `${pickUpPhotoBase(of)}/${size}?v=${photoId}`
}

function sendPhoto(url: string, method: 'POST' | 'PUT', file: File): Promise<Response> {
  const body = new FormData()
  body.append('photo', file)
  return fetch(url, { method, body })
}

/** Adds a photo to a Child's gallery. Admins only, and only with photo Consent. */
export async function addChildPhoto(childId: number, file: File): Promise<Photo | Refusal> {
  const response = await sendPhoto(`/api/children/${childId}/photos`, 'POST', file)
  if (!response.ok) return refusalOf(response, 'Adding the photo')
  return (await response.json()) as Photo
}

/** Deletes a photo of a Child for good. Admins only. Resolves to true once deleted. */
export async function deleteChildPhoto(childId: number, photoId: number): Promise<true | Refusal> {
  const response = await fetch(`/api/children/${childId}/photos/${photoId}`, { method: 'DELETE' })
  if (!response.ok) return refusalOf(response, 'Deleting the photo')
  return true
}

/** Sets a Pick-up person's photo, replacing any earlier one. Admins only. Resolves to true once set. */
export async function setPickUpPhoto(of: PickUpPhoto, file: File): Promise<true | Refusal> {
  const response = await sendPhoto(pickUpPhotoBase(of), 'PUT', file)
  if (!response.ok) return refusalOf(response, 'Setting the photo')
  return true
}

/** Removes a Pick-up person's photo. Admins only. Resolves to true once removed. */
export async function removePickUpPhoto(of: PickUpPhoto): Promise<true | Refusal> {
  const response = await fetch(pickUpPhotoBase(of), { method: 'DELETE' })
  if (!response.ok) return refusalOf(response, 'Removing the photo')
  return true
}

// The icons a Group can have, each drawn as an emoji.
export const groupIcons = {
  monkey: '🐒',
  butterfly: '🦋',
  bee: '🐝',
  ladybird: '🐞',
  frog: '🐸',
  fox: '🦊',
  bear: '🐻',
  rabbit: '🐰',
  owl: '🦉',
  hedgehog: '🦔',
  turtle: '🐢',
  fish: '🐟',
  sun: '☀️',
  flower: '🌸',
  tree: '🌳',
  star: '⭐',
} as const
export type GroupIcon = keyof typeof groupIcons
export type GroupDetails = { name: string; icon: GroupIcon }
export type Group = GroupDetails & { id: number }
// mine: whether the logged-in Staff member works in it.
export type ListedGroup = Group & { mine: boolean }

/** All Groups, by name. */
export async function fetchGroups(): Promise<ListedGroup[]> {
  const response = await fetch('/api/groups')
  if (!response.ok) throw new Error(`Loading the Groups failed: ${response.status}`)
  return (await response.json()) as ListedGroup[]
}

/** Creates a Group, or changes the one with `id`. Admins only. */
export async function saveGroup(details: GroupDetails, id?: number): Promise<Group | Refusal> {
  const response = id === undefined ? await sendJson('/api/groups', 'POST', details) : await sendJson(`/api/groups/${id}`, 'PUT', details)
  if (!response.ok) return refusalOf(response, 'Saving the Group')
  return (await response.json()) as Group
}

/** Removes a Group; its Children stay, in no Group. Admins only. Resolves to true once removed. */
export async function removeGroup(id: number): Promise<true | Refusal> {
  const response = await fetch(`/api/groups/${id}`, { method: 'DELETE' })
  if (!response.ok) return refusalOf(response, 'Removing the Group')
  return true
}

// A Child's day at the Kita: checked in at, and out at (null while still there); UTC times.
export type AttendanceDay = { checkedInAt: string; checkedOutAt: string | null }
export type AbsenceReason = 'sick' | 'holiday' | 'other'
export const absenceReasonLabel = { sick: 'absenceSick', holiday: 'absenceHoliday', other: 'absenceOther' } as const
// Days a Child will not come (YYYY-MM-DD, both included), and why.
export type Absence = { id: number; startsOn: string; endsOn: string; reason: AbsenceReason }
// One of a Group's Children today.
export type GroupChild = ChildSummary & { alerts: Alert[]; attendance: AttendanceDay | null; absence: Absence | null; birthdayToday: boolean }
// The Group dashboard, the Today view: the Group, the day at the Kita, its Children by first name.
export type GroupDashboard = Group & { day: string; children: GroupChild[] }

export type AttendanceStep = 'check-in' | 'check-out' | 'undo'

/** Checks a Child in or out today, or undoes today's last of these. Resolves to true once done. */
export async function attendanceStep(childId: number, step: AttendanceStep): Promise<true | Refusal> {
  const response = await fetch(`/api/children/${childId}/attendance/${step}`, { method: 'POST' })
  if (!response.ok) return refusalOf(response, 'Recording the attendance')
  return true
}

/** Records that a Child will not come from `startsOn` to `endsOn`. */
export async function addAbsence(childId: number, absence: Omit<Absence, 'id'>): Promise<Absence | Refusal> {
  const response = await sendJson(`/api/children/${childId}/absences`, 'POST', absence)
  if (!response.ok) return refusalOf(response, 'Recording the Absence')
  return (await response.json()) as Absence
}

/** Removes an Absence (e.g. recorded by mistake). Resolves to true once removed. */
export async function removeAbsence(childId: number, absenceId: number): Promise<true | Refusal> {
  const response = await fetch(`/api/children/${childId}/absences/${absenceId}`, { method: 'DELETE' })
  if (!response.ok) return refusalOf(response, 'Removing the Absence')
  return true
}

/** A Group's dashboard, or null when there is no such Group. */
export async function fetchGroupDashboard(id: number): Promise<GroupDashboard | null> {
  const response = await fetch(`/api/groups/${id}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Loading the Group dashboard failed: ${response.status}`)
  return (await response.json()) as GroupDashboard
}

/** Puts a Child in a Group, or in none (null). Admins only. Resolves to true once done. */
export async function putChildInGroup(childId: number, groupId: number | null): Promise<true | Refusal> {
  const response = await sendJson(`/api/children/${childId}/group`, 'PUT', { groupId })
  if (!response.ok) return refusalOf(response, 'Changing the Group')
  return true
}

/** Says which Groups a Staff member works in. Admins only. */
export async function setStaffGroups(accountId: number, groupIds: number[]): Promise<StaffAccount | Refusal> {
  const response = await sendJson(`/api/staff/${accountId}/groups`, 'PUT', { groupIds })
  if (!response.ok) return refusalOf(response, 'Changing the Groups')
  return (await response.json()) as StaffAccount
}

// A Group's Task board: its Tasks, each in one column. The To do ones are the backlog, in the
// order the API gives them: the first is the most important.
export type TaskStatus = 'toDo' | 'doing' | 'done'
export const taskStatusLabel = { toDo: 'taskStatusToDo', doing: 'taskStatusDoing', done: 'taskStatusDone' } as const
// A Staff member a Task can be given to: one who works in its Group.
export type Assignee = { id: number; email: string }
// dueOn: YYYY-MM-DD, or null.
export type TaskDetails = { title: string; note: string; assigneeId: number | null; dueOn: string | null; labels: string[] }
export type Task = Omit<TaskDetails, 'assigneeId'> & { id: number; status: TaskStatus; assignee: Assignee | null }

/** Whom a Group's Tasks can be given to, by email address. */
export async function fetchAssignees(groupId: number): Promise<Assignee[]> {
  const response = await fetch(`/api/groups/${groupId}/assignees`)
  if (!response.ok) throw new Error(`Loading the Group's Staff members failed: ${response.status}`)
  return (await response.json()) as Assignee[]
}

/** Puts a Group's backlog in this order, most important first. Resolves to 'backlogChanged'
 * when it no longer has exactly these Tasks (someone else changed it meanwhile). */
export async function reorderBacklog(groupId: number, taskIds: number[]): Promise<true | Refusal> {
  const response = await sendJson(`/api/groups/${groupId}/backlog`, 'PUT', { taskIds })
  if (!response.ok) return refusalOf(response, 'Reordering the backlog')
  return true
}

/** A Group's Tasks, each column in its order (so To do in Backlog order), or null when there
 * is no such Group. */
export async function fetchTasks(groupId: number): Promise<Task[] | null> {
  const response = await fetch(`/api/groups/${groupId}/tasks`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Loading the Task board failed: ${response.status}`)
  return (await response.json()) as Task[]
}

/** Adds a Task to a Group's board, in To do. */
export async function addTask(groupId: number, details: TaskDetails): Promise<Task | Refusal> {
  const response = await sendJson(`/api/groups/${groupId}/tasks`, 'POST', details)
  if (!response.ok) return refusalOf(response, 'Adding the Task')
  return (await response.json()) as Task
}

/** Changes a Task's title and note. */
export async function updateTask(groupId: number, taskId: number, details: TaskDetails): Promise<Task | Refusal> {
  const response = await sendJson(`/api/groups/${groupId}/tasks/${taskId}`, 'PUT', details)
  if (!response.ok) return refusalOf(response, 'Changing the Task')
  return (await response.json()) as Task
}

/** Moves a Task to a column. Resolves to true once moved. */
export async function moveTask(groupId: number, taskId: number, status: TaskStatus): Promise<true | Refusal> {
  const response = await sendJson(`/api/groups/${groupId}/tasks/${taskId}/status`, 'PUT', { status })
  if (!response.ok) return refusalOf(response, 'Moving the Task')
  return true
}

/** Deletes a Task. Resolves to true once deleted. */
export async function removeTask(groupId: number, taskId: number): Promise<true | Refusal> {
  const response = await fetch(`/api/groups/${groupId}/tasks/${taskId}`, { method: 'DELETE' })
  if (!response.ok) return refusalOf(response, 'Deleting the Task')
  return true
}

// The Calendar: Events for a Group (group set) or the whole Kita (group null). An all-day Event
// has no times and may span days; a timed one is on one day. Dates are YYYY-MM-DD, times
// HH:MM:SS (sent as HH:MM), all the Kita's.
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export type CalendarEvent = {
  id: number
  group: Group | null
  title: string
  note: string
  startsOn: string
  endsOn: string
  startTime: string | null
  endTime: string | null
  repeat: Repeat
  repeatEvery: number
  repeatUntil: string | null
  // Days before each time it happens its Staff are emailed a Reminder (0: that morning); null: never.
  remindDaysBefore: number | null
}
export type EventDetails = Omit<CalendarEvent, 'id' | 'group'> & { groupId: number | null }
// One time an Event happens, from its first to its last day.
export type Occurrence = { event: CalendarEvent; startsOn: string; endsOn: string }

// A Child's Birthday in a span: who, and the day (the year of birth is not shown).
export type Birthday = { childId: number; firstName: string; lastName: string; on: string }
export type HolidayKind = 'public' | 'school'
// Each kind of Holiday: its icon and texts (the heading of its kind, one Holiday, the import button).
export const holidayKinds = {
  public: { icon: '🎉', heading: 'publicHolidays', one: 'publicHoliday', importButton: 'importPublicHolidays' },
  school: { icon: '🏖️', heading: 'schoolHolidays', one: 'schoolHoliday', importButton: 'importSchoolHolidays' },
} as const
// A Holiday of the Kita's region, from its first to its last day.
export type Holiday = { kind: HolidayKind; name: string; startsOn: string; endsOn: string }
// What a span of days holds, each list in order.
export type CalendarSpan = { events: Occurrence[]; birthdays: Birthday[]; holidays: Holiday[] }

/** What happens from `from` to `to` (both included): for a Group, its own and the whole Kita's
 * Events and its Children's Birthdays; for no Group, everything. Holidays in both. */
export async function fetchCalendar(from: string, to: string, groupId: number | null): Promise<CalendarSpan> {
  const group = groupId === null ? '' : `&groupId=${groupId}`
  const response = await fetch(`/api/calendar?from=${from}&to=${to}${group}`)
  if (!response.ok) throw new Error(`Loading the Calendar failed: ${response.status}`)
  return (await response.json()) as CalendarSpan
}

// Each kind of Holidays imported so far: how many, from the first to the last day.
export type HolidaysImported = { kind: HolidayKind; count: number; firstDay: string; lastDay: string }

/** The Holidays imported so far, or 'adminsOnly'. */
export async function fetchImportedHolidays(): Promise<HolidaysImported[] | Refusal> {
  const response = await fetch('/api/holidays')
  if (!response.ok) return refusalOf(response, 'Loading the holidays')
  return (await response.json()) as HolidaysImported[]
}

/** Imports an iCal file's Holidays as `kind`, in place of all of that kind so far. Admins only.
 * Resolves to how many were imported. */
export async function importHolidays(kind: HolidayKind, file: File): Promise<number | Refusal> {
  const form = new FormData()
  form.append('file', file)
  const response = await fetch(`/api/holidays/${kind}`, { method: 'PUT', body: form })
  if (!response.ok) return refusalOf(response, 'Importing the holidays')
  return ((await response.json()) as { imported: number }).imported
}

/** Adds an Event, or changes the one with `id` (every time it happens, if it repeats). */
export async function saveEvent(details: EventDetails, id?: number): Promise<CalendarEvent | Refusal> {
  const response = id === undefined ? await sendJson('/api/events', 'POST', details) : await sendJson(`/api/events/${id}`, 'PUT', details)
  if (!response.ok) return refusalOf(response, 'Saving the Event')
  return (await response.json()) as CalendarEvent
}

/** Removes an Event, every time it happens. Resolves to true once removed. */
export async function removeEvent(id: number): Promise<true | Refusal> {
  const response = await fetch(`/api/events/${id}`, { method: 'DELETE' })
  if (!response.ok) return refusalOf(response, 'Deleting the Event')
  return true
}
