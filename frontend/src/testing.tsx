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
      // An upload is recorded by its fields' names and files' names.
      const body =
        init?.body instanceof FormData
          ? Object.fromEntries([...init.body].map(([name, value]) => [name, value instanceof File ? value.name : value]))
          : init?.body
            ? JSON.parse(init.body as string)
            : undefined
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

// Replies for fakeApi: the API is up, and who is logged in.
export const health = { status: 200, body: { status: 'ok', database: 'ok', time: '2027-01-04T08:00:00Z' } }

export function sessionAs(role: 'admin' | 'teacher') {
  return { status: 200, body: { email: `${role}@kita.example`, role, inactivityTimeoutMinutes: 30 } }
}

// The lists a Child profile carries besides the Child's own fields, all empty.
export const noProfileLists = {
  alerts: [],
  absences: [],
  parents: [],
  emergencyContacts: [],
  pickUpPersons: [],
  consents: { photo: [], excursion: [], dataProtection: [] },
  photos: [],
  group: null,
}
