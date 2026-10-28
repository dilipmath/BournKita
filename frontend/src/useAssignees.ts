import { useEffect, useState } from 'react'
import { fetchAssignees, type Assignee } from './api'

/** Whom a Group's Tasks can be given to; undefined while loading, none if that failed (the form
 * still works, without an assignee). */
export function useAssignees(groupId: number): Assignee[] | undefined {
  const [assignees, setAssignees] = useState<{ groupId: number; list: Assignee[] }>()

  useEffect(() => {
    let latest = true
    fetchAssignees(groupId)
      .then((list) => latest && setAssignees({ groupId, list }))
      .catch(() => latest && setAssignees({ groupId, list: [] }))
    return () => {
      latest = false
    }
  }, [groupId])

  return assignees?.groupId === groupId ? assignees.list : undefined
}
