import type { Alert } from './api'
import Icon from './Icon'

type Props = {
  /** What the alerts are, e.g. "Allergies". */
  label: string
  alerts: Alert[]
}

/** A small, hard-to-miss marker naming alerts, e.g. a warning sign and "Allergies: Peanuts, Hazelnuts"; nothing
 * when there are none. */
export default function AlertMarker({ label, alerts }: Props) {
  if (alerts.length === 0) return null
  return (
    <span className="alert-marker">
      <Icon name="alert" />
      {label}: {alerts.map((alert) => alert.name).join(', ')}
    </span>
  )
}
