type CrashReport = { errorType: string; page: string; version: string; frames: string[] }

// The same shapes the API accepts; anything else could carry free text and is dropped.
const errorTypePattern = /^[A-Za-z_$][A-Za-z0-9_$]{0,99}$/
const sectionPattern = /^[A-Za-z0-9_-]{1,50}$/
const assetPathPattern = /^\/[A-Za-z0-9_\-./]{0,199}$/
// "at fn (http://host/assets/x.js:1:2)" in Chrome, "fn@http://host/assets/x.js:1:2" in Firefox and Safari.
const stackLocation = /(https?:\/\/[^\s()]+?):(\d+):(\d+)/g
const maxFrames = 50
// A crash loop must not flood the server.
const maxReportsPerPageLoad = 10

/** Reports uncaught errors and unhandled promise rejections to the API. Returns a function that stops it. */
export function installCrashReporting(version: string): () => void {
  let sent = 0
  const report = (error: unknown) => {
    if (sent >= maxReportsPerPageLoad) return
    sent += 1
    fetch('/api/crash-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCrashReport(error, window.location.pathname, version)),
      keepalive: true,
    }).catch(() => {
      // Nowhere left to report to; the error itself still shows in the console.
    })
  }
  const onError = (event: ErrorEvent) => report(event.error)
  const onRejection = (event: PromiseRejectionEvent) => report(event.reason)
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}

/** An anonymised report of an error: its type and code locations, never its message or the page's data. */
function buildCrashReport(error: unknown, pathname: string, version: string): CrashReport {
  return {
    errorType: error instanceof Error && errorTypePattern.test(error.name) ? error.name : 'NonErrorThrown',
    page: pageSection(pathname),
    version,
    frames: error instanceof Error ? codeLocations(stackWithoutMessage(error)) : [],
  }
}

// Only the first path segment: deeper segments could be IDs or, in a careless route, names.
function pageSection(pathname: string): string {
  const [section = '', ...rest] = pathname.split('/').filter(Boolean)
  if (section === '') return '/'
  if (!sectionPattern.test(section)) return '/unknown'
  return rest.length > 0 ? `/${section}/*` : `/${section}`
}

// Chrome starts the stack with "Name: message", and a URL in the message must not pass for a frame.
function stackWithoutMessage(error: Error): string {
  const stack = error.stack ?? ''
  const header = error.message ? `${error.name}: ${error.message}` : error.name
  return stack.startsWith(header) ? stack.slice(header.length) : stack
}

function codeLocations(stack: string): string[] {
  const frames: string[] = []
  for (const [, url, line, column] of stack.matchAll(stackLocation)) {
    const path = new URL(url).pathname
    if (assetPathPattern.test(path)) frames.push(`${path}:${line}:${column}`)
  }
  return frames.slice(0, maxFrames)
}
