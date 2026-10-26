import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import './i18n'

type Reply = { status: number; body?: unknown }
type Handler = (body: unknown) => Reply

/** Stubs fetch with a fake API: keys are "METHOD /path", values give the reply. Records calls. */
export function fakeApi(routes: Record<string, Reply | Handler>) {
  const calls: { route: string; body: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const route = `${init?.method ?? 'GET'} ${url}`
      const body = init?.body ? JSON.parse(init.body as string) : undefined
      calls.push({ route, body })
      const reply = routes[route]
      if (!reply) throw new Error(`No fake for ${route}`)
      const { status, body: replyBody } = typeof reply === 'function' ? reply(body) : reply
      return new Response(replyBody === undefined ? null : JSON.stringify(replyBody), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
  return calls
}

export function renderAt(path: string, ui: ReactNode) {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>)
}
