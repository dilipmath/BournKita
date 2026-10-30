// @vitest-environment happy-dom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
import i18n from './i18n'
import { fakeApi, health, renderAt, sessionAs } from './testing'

const monkeys = { id: 2, name: 'Monkeys', icon: 'monkey' }

function api() {
  fakeApi({
    'GET /api/health': health,
    'GET /api/session': sessionAs('teacher'),
    'GET /api/groups': { status: 200, body: [{ ...monkeys, mine: true }] },
    'GET /api/groups/2': { status: 200, body: { ...monkeys, day: '2027-01-04', children: [] } },
  })
}

describe('Emergency list', () => {
  it('opens a Group’s list from its Today view, in the language of the app', async () => {
    api()
    renderAt('/groups/2', <App />)

    const link = await screen.findByRole('link', { name: 'Emergency list (PDF)' })

    expect(link).toHaveAttribute('href', '/api/emergency-list?groupId=2&language=en')
    // In a tab of its own, from where the tablet prints it.
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('opens the whole Kita’s list from the start page', async () => {
    api()
    await i18n.changeLanguage('de')
    try {
      renderAt('/', <App />)

      const link = await screen.findByRole('link', { name: 'Notfallliste der ganzen Kita (PDF)' })

      expect(link).toHaveAttribute('href', '/api/emergency-list?language=de')
      expect(link).toHaveAttribute('target', '_blank')
    } finally {
      await i18n.changeLanguage('en')
    }
  })
})
