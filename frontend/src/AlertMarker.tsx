import type { Alert } from './api'

type Props = {
  /** What the alerts are, e.g. "Allergies". */
  label: string
  alerts: Alert[]
}

/** A small, hard-to-miss marker naming alerts, e.g. "⚠ Allergies: Peanuts, Hazelnuts"; nothing
 * when there are none. */
export default function AlertMarker({ label, alerts }: Props) {
  if (alerts.length === 0) return null
  return (
    <span className="alert-marker">
      <span aria-hidden="true">⚠ </span>
      {label}: {alerts.map((alert) => alert.name).join(', ')}
    </span>
  )
}
