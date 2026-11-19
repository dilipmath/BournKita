import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ToastContext, type ShowToast } from './toastContext'

type Toast = { message: string; undo?: () => void; id: number }
/** Says what just happened, at the bottom of the screen, and goes away by itself; with Undo, it
 * stays a little longer. A confirmation only: nothing a Staff member must read lives only here. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [toast, setToast] = useState<Toast | null>(null)
  const next = useRef(0)

  const show = useCallback<ShowToast>((message, undo) => {
    next.current += 1
    setToast({ message, undo, id: next.current })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), toast.undo ? 7000 : 4500)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Always there, so screen readers announce what appears in it; not a "status" of its own,
          which belongs to the page's own messages. */}
      <div className="toast-region" aria-live="polite">
        {toast && (
          <div key={toast.id} className="toast">
            <span>{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  toast.undo?.()
                  setToast(null)
                }}
              >
                {t('undo')}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
