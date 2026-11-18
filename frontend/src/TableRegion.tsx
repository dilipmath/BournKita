import type { ReactNode } from 'react'

/** A table that scrolls sideways inside its own frame, so it never widens the page on a phone.
 * Named and reachable with the keyboard, so it can be scrolled without a mouse. */
export default function TableRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="table-region" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  )
}
