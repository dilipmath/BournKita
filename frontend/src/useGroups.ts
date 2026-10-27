import { useEffect, useState } from 'react'
import { fetchGroups, type ListedGroup } from './api'

/** All Groups, for a drop-down or checkboxes: undefined while loading, and none if they could not
 * be loaded (the page still works, without them). `enabled` false skips loading. */
export function useGroups(enabled = true): ListedGroup[] | undefined {
  const [groups, setGroups] = useState<ListedGroup[]>()

  useEffect(() => {
    if (!enabled) return
    fetchGroups()
      .then(setGroups)
      .catch(() => setGroups([]))
  }, [enabled])

  return groups
}
