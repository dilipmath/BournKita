import { useState } from 'react'
import type { Refusal } from './api'

export type Problem = Refusal | 'somethingWentWrong' | null

/** For a section of a profile that changes it: `change` runs an API call, then reloads the
 * profile, or keeps the refusal (or failure) in `problem` for the section to show. Resolves to
 * whether it worked. */
export function useProfileChange(reload: () => void) {
  const [problem, setProblem] = useState<Problem>(null)

  async function change(call: () => Promise<unknown>): Promise<boolean> {
    setProblem(null)
    try {
      const result = await call()
      if (typeof result === 'string') {
        setProblem(result as Refusal)
        return false
      }
      reload()
      return true
    } catch {
      setProblem('somethingWentWrong')
      return false
    }
  }

  return { problem, change }
}
