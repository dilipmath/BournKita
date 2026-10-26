// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installCrashReporting } from './crash'

let uninstall: () => void
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 202 })))
  vi.stubGlobal('fetch', fetchMock)
  window.history.replaceState(null, '', '/')
  uninstall = installCrashReporting('1.2.0')
})

afterEach(() => {
  uninstall()
  vi.unstubAllGlobals()
})

function throwUncaught(error: unknown): void {
  window.dispatchEvent(new ErrorEvent('error', { error }))
}

function rejectUnhandled(reason: unknown): void {
  window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason }))
}

function errorWithStack(error: Error, stack: string): Error {
  error.stack = stack
  return error
}

function sentReports(): unknown[] {
  return fetchMock.mock.calls.map(([url, init]) => {
    expect(url).toBe('/api/crash-reports')
    expect(init?.method).toBe('POST')
    return JSON.parse(init?.body as string)
  })
}

describe('crash reporting', () => {
  it('reports an uncaught error with its type, page, version and code locations', () => {
    window.history.replaceState(null, '', '/groups')
    throwUncaught(
      errorWithStack(
        new TypeError('x is undefined'),
        [
          'TypeError: x is undefined',
          '    at App (http://kita.local/assets/index-a1b2c3.js:12:345)',
          '    at http://kita.local/assets/vendor-d4e5f6.js:1:67',
        ].join('\n'),
      ),
    )

    expect(sentReports()).toEqual([
      {
        errorType: 'TypeError',
        page: '/groups',
        version: '1.2.0',
        frames: ['/assets/index-a1b2c3.js:12:345', '/assets/vendor-d4e5f6.js:1:67'],
      },
    ])
  })

  it('reads code locations from a Firefox and Safari stack', () => {
    throwUncaught(
      errorWithStack(
        new RangeError('bad'),
        'render@http://kita.local/assets/index-a1b2c3.js:3:14\n@http://kita.local/assets/index-a1b2c3.js:9:2',
      ),
    )

    expect(sentReports()).toMatchObject([
      { frames: ['/assets/index-a1b2c3.js:3:14', '/assets/index-a1b2c3.js:9:2'] },
    ])
  })

  it('leaves out the error message, the query string and the fragment', () => {
    const personalData = 'Anna Müller, Hauptstraße 5, Erdnussallergie'
    window.history.replaceState(
      null,
      '',
      `/children?search=${encodeURIComponent(personalData)}#${encodeURIComponent(personalData)}`,
    )

    throwUncaught(
      errorWithStack(
        new Error(personalData),
        `Error: ${personalData}\n    at save (http://kita.local/assets/index-a1b2c3.js:1:2)`,
      ),
    )

    const [report] = sentReports()
    expect(report).toMatchObject({ page: '/children' })
    expect(JSON.stringify(report)).not.toContain('Anna')
    expect(JSON.stringify(report)).not.toContain('Erdnuss')
  })

  it('reports only the section of a deeper page, so names or IDs in the path stay out', () => {
    window.history.replaceState(null, '', '/children/anna-mueller/photos')

    throwUncaught(new Error('boom'))

    expect(sentReports()).toMatchObject([{ page: '/children/*' }])
  })

  it('does not mistake a URL in the error message for a code location', () => {
    throwUncaught(
      errorWithStack(
        new Error('Could not load http://kita.local/children/Anna:1:2'),
        'Error: Could not load http://kita.local/children/Anna:1:2\n    at load (http://kita.local/assets/index-a1b2c3.js:4:5)',
      ),
    )

    expect(sentReports()).toMatchObject([{ frames: ['/assets/index-a1b2c3.js:4:5'] }])
  })

  it('reports an unhandled rejection with a non-error value without the value', () => {
    rejectUnhandled('Anna Müller')

    expect(sentReports()).toEqual([{ errorType: 'NonErrorThrown', page: '/', version: '1.2.0', frames: [] }])
  })

  it('stops after ten reports per page load so a crash loop cannot flood the server', () => {
    for (let i = 0; i < 12; i++) throwUncaught(new Error('boom'))

    expect(sentReports()).toHaveLength(10)
  })
})
