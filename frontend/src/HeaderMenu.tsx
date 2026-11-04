import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

type Props = { label: ReactNode; ariaLabel?: string; className?: string; children: ReactNode }

/** A button in the header that opens a small menu below it. Closes on Escape, on a tap outside,
 * and when something in it is chosen. */
export default function HeaderMenu({ label, ariaLabel, className = '', children }: Props) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const outside = (target: EventTarget | null) => !root.current?.contains(target as Node)
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      // Back to where the keyboard was, not to the top of the page.
      button.current?.focus()
    }
    const onPointer = (event: PointerEvent) => outside(event.target) && setOpen(false)
    // Tabbing past the last item leaves the menu, so it closes.
    const onFocus = (event: FocusEvent) => outside(event.target) && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('focusin', onFocus)
    }
  }, [open])

  return (
    <div className={`header-menu ${className}`} ref={root}>
      <button ref={button} type="button" aria-label={ariaLabel} aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        // Following a link inside has done its work, so the menu closes (a language choice does not).
        <div id={menuId} className="header-menu-items" onClick={(event) => (event.target as Element).closest('a') && setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}
