import { useTranslation } from 'react-i18next'
import { emergencyListUrl } from './api'

/** Opens the emergency list PDF (the Children here now, their Alerts and whom to call) in a tab
 * of its own, from where a tablet prints it. Without a Group, the whole Kita's. */
export default function EmergencyListLink({ groupId = null }: { groupId?: number | null }) {
  const { t, i18n } = useTranslation()
  return (
    <a className="button" href={emergencyListUrl(groupId, i18n.language)} target="_blank" rel="noopener">
      {t(groupId === null ? 'emergencyListOfKita' : 'emergencyList')}
    </a>
  )
}
