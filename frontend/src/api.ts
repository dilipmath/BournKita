export type Health = { status: 'ok' | 'degraded'; database: 'ok' | 'unavailable'; time: string }

export async function fetchHealth(): Promise<Health> {
  const response = await fetch('/api/health')
  // 503 still carries a Health body that says which part is down.
  if (!response.ok && response.status !== 503) throw new Error(`Health check failed: ${response.status}`)
  return (await response.json()) as Health
}
