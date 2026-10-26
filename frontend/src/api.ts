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

/** Logs in; resolves to 'invalidCredentials' when the email address or password is wrong. */
export async function logIn(email: string, password: string): Promise<Session | 'invalidCredentials'> {
  const response = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (response.status === 401) return 'invalidCredentials'
  if (!response.ok) throw new Error(`Login failed: ${response.status}`)
  return (await response.json()) as Session
}

export async function logOut(): Promise<void> {
  const response = await fetch('/api/session', { method: 'DELETE' })
  if (!response.ok) throw new Error(`Logout failed: ${response.status}`)
}
