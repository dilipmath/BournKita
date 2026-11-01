// @vitest-environment happy-dom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { fakeApi, health, renderAt } from './testing'

const loggedOut = { status: 401, body: { detail: 'not_logged_in' } }

/** The language module as a fresh page load sets it up. */
async function loadAgain() {
  vi.resetModules()
  const { default: i18n } = await import('./i18n')
  return i18n
}

describe('language', () => {
  afterEach(async () => {
    const { default: i18n } = await import('./i18n')
    await i18n.changeLanguage('en')
    // Last: changing the language keeps it.
    localStorage.clear()
  })

  it('stays as chosen when the app is loaded again, e.g. after the tablet wakes up', async () => {
    fakeApi({ 'GET /api/health': health, 'GET /api/session': loggedOut })
    renderAt('/', <App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Deutsch' }))
    expect(await screen.findByRole('button', { name: 'Anmelden' })).toBeInTheDocument()
    // A new page starts without it.
    document.documentElement.lang = ''

    const reloaded = await loadAgain()

    expect(reloaded.language).toBe('de')
    expect(document.documentElement.lang).toBe('de')
  })

  it('starts in English on a device where nothing was chosen', async () => {
    const { default: i18n } = await import('./i18n')
    await i18n.changeLanguage('de')
    localStorage.clear()

    const fresh = await loadAgain()

    expect(fresh.language).toBe('en')
  })
})
