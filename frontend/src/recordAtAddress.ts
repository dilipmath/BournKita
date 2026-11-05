import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

// A record named by the page's address: undefined while loading, null when there is none.
// failed with a record: a reload failed, so the record is the one loaded at loadedAt.
export type Loaded<T> = { record: T | null | undefined; failed: boolean; loadedAt?: string }

/** Loads the record whose ID is the address's `:id`, and gives a way to load it again after a
 * change on the same page (the same function on every render). `fetchRecord` resolves to null
 * when there is no such record. A failed reload keeps the record shown rather than emptying the
 * page. */
export function useRecordAtAddress<T>(fetchRecord: (id: number) => Promise<T | null>): [Loaded<T>, () => void] {
  const id = Number(useParams().id)
  const [loaded, setLoaded] = useState<Loaded<T> & { id: number }>()
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!Number.isInteger(id)) return
    // After moving to another record, a late answer about the previous one must not show.
    let latest = true
    fetchRecord(id)
      .then((record) => latest && setLoaded({ id, record, failed: false, loadedAt: new Date().toISOString() }))
      .catch(
        () =>
          latest &&
          setLoaded((last) => (last?.id === id && last.record ? { ...last, failed: true } : { id, record: undefined, failed: true })),
      )
    return () => {
      latest = false
    }
  }, [id, version, fetchRecord])

  const reload = useCallback(() => setVersion((current) => current + 1), [])
  if (!Number.isInteger(id)) return [{ record: null, failed: false }, reload]
  // Still loading this record, even if another one was loaded before.
  if (loaded?.id !== id) return [{ record: undefined, failed: false }, reload]
  return [loaded, reload]
}
