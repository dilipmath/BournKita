import { useId, type ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

type Props = {
  icon: IconName
  /** The panel's heading; left out when what it holds has a heading of its own. */
  title?: string
  children: ReactNode
}

/** A section of a profile (a Child's drawer, a Parent's page): a panel with an icon beside its
 * title. */
export default function Panel({ icon, title, children }: Props) {
  const headingId = useId()
  return (
    <div className="profile-panel">
      <Icon name={icon} />
      {title === undefined ? (
        children
      ) : (
        <section aria-labelledby={headingId}>
          <h3 id={headingId}>{title}</h3>
          {children}
        </section>
      )}
    </div>
  )
}
