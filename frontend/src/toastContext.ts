import { createContext, useContext } from 'react'

export type ShowToast = (message: string, undo?: () => void) => void

export const ToastContext = createContext<ShowToast>(() => undefined)

/** Shows a toast: what happened, and how to take it back if it can be. */
export function useToast(): ShowToast {
  return useContext(ToastContext)
}
