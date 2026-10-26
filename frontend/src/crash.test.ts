import { describe, expect, it } from 'vitest'
import { buildCrashReport } from './crash'

function errorWithStack(error: Error, stack: string): Error {
  error.stack = stack
  return error
}

describe('buildCrashReport', () => {
  it('reports the error type, page, version and code locations from a Chrome stack', () => {
    const error = errorWithStack(
      new TypeError('x is undefined'),
      [
        'TypeError: x is undefined',
        '    at App (http://kita.local/assets/index-a1b2c3.js:12:345)',
        '    at http://kita.local/assets/vendor-d4e5f6.js:1:67',
      ].join('\n'),
    )

    expect(buildCrashReport(error, 'http://kita.local/groups/3', '1.2.0')).toEqual({
      errorType: 'TypeError',
      page: '/groups/3',
      version: '1.2.0',
      frames: ['/assets/index-a1b2c3.js:12:345', '/assets/vendor-d4e5f6.js:1:67'],
    })
  })

  it('reads code locations from a Firefox and Safari stack', () => {
    const error = errorWithStack(
      new RangeError('bad'),
      'render@http://kita.local/assets/index-a1b2c3.js:3:14\n@http://kita.local/assets/index-a1b2c3.js:9:2',
    )

    expect(buildCrashReport(error, 'http://kita.local/', '1.2.0').frames).toEqual([
      '/assets/index-a1b2c3.js:3:14',
      '/assets/index-a1b2c3.js:9:2',
    ])
  })

  it('leaves out the error message, the query string and the fragment', () => {
    const personalData = 'Anna Müller, Hauptstraße 5, Erdnussallergie'
    const error = errorWithStack(
      new Error(personalData),
      `Error: ${personalData}\n    at save (http://kita.local/assets/index-a1b2c3.js:1:2)`,
    )

    const report = buildCrashReport(
      error,
      `http://kita.local/children?search=${encodeURIComponent(personalData)}#${encodeURIComponent(personalData)}`,
      '1.2.0',
    )

    expect(report.page).toBe('/children')
    expect(JSON.stringify(report)).not.toContain('Anna')
    expect(JSON.stringify(report)).not.toContain('Erdnuss')
  })

  it('does not mistake a URL in the error message for a code location', () => {
    const error = errorWithStack(
      new Error('Could not load http://kita.local/children/Anna:1:2'),
      'Error: Could not load http://kita.local/children/Anna:1:2\n    at load (http://kita.local/assets/index-a1b2c3.js:4:5)',
    )

    expect(buildCrashReport(error, 'http://kita.local/', '1.2.0').frames).toEqual(['/assets/index-a1b2c3.js:4:5'])
  })

  it('reports a thrown non-error without its value', () => {
    const report = buildCrashReport('Anna Müller', 'http://kita.local/', '1.2.0')

    expect(report).toEqual({ errorType: 'NonErrorThrown', page: '/', version: '1.2.0', frames: [] })
  })
})
