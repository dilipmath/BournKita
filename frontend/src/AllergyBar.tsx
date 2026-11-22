import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { GroupChild, GroupColour } from './api'
import ChildSymbol from './ChildSymbol'
import Icon from './Icon'

type Props = {
  /** The Group's Children who have an Alert and are here or still to come. */
  items: GroupChild[]
  colour: GroupColour
}

/** At the top of a Group's Today, for whoever serves food: each Child here or still to come who
 * has an Alert, with what it is. Nothing when there is none. */
export default function AllergyBar({ items, colour }: Props) {
  const { t } = useTranslation()
  const headingId = useId()
  if (items.length === 0) return null
  return (
    <section className="allergy-bar" aria-labelledby={headingId}>
      <Icon name="alert" />
      <div>
        <h3 id={headingId}>{t('alertsToday')}</h3>
        <ul>
          {items.map((child) => (
            <li key={child.id}>
              <span className={`allergy-bar-symbol group-colour-${colour}`}>
                <ChildSymbol symbol={child.symbol} />
              </span>
              {child.firstName} {child.lastName} <strong>{child.alerts.map((alert) => alert.name).join(', ')}</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
