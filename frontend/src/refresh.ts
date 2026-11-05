import { useCallback, useEffect, useRef, useState } from 'react'

// A tablet on the wall stays current without loading the small server more often than this.
export const REFRESH_EVERY_MS = 5 * 60_000

/** Calls `reload` when the tablet wakes up and every 5 minutes while the page is visible; never
 * while it is hidden. `reload` should keep its identity between renders (useCallback). */
export function useRefresh(reload: () => void) {
  useEffect(() => {
    const ifVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    const timer = window.setInterval(ifVisible, REFRESH_EVERY_MS)
    document.addEventListener('visibilitychange', ifVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', ifVisible)
    }
  }, [reload])
}

// data: the last answer, null until the first; stale: the last refresh failed, so it is older.
export type Live<T> = { data: T | null; failed: boolean; stale: boolean; updatedAt: string | null }

/** Loads with `fetchData` and keeps it fresh (see useRefresh). A failed refresh keeps the last
 * answer rather than emptying the page. */
export function useLiveData<T>(fetchData: () => Promise<T>): Live<T> {
  const [live, setLive] = useState<Live<T>>({ data: null, failed: false, stale: false, updatedAt: null })
  // Only the newest load counts: an older one answering late must not overwrite it, and none
  // after the page is gone.
  const newest = useRef(0)
  const load = useCallback(() => {
    const mine = ++newest.current
    fetchData()
      .then((data) => mine === newest.current && setLive({ data, failed: false, stale: false, updatedAt: new Date().toISOString() }))
      .catch(
        () =>
          mine === newest.current &&
          setLive((last) => (last.data === null ? { ...last, failed: true } : { ...last, stale: true })),
      )
  }, [fetchData])
  useEffect(() => {
    load()
    return () => {
      newest.current = -1
    }
  }, [load])
  useRefresh(load)
  return live
}
