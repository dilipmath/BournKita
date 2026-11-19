import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { groupIcons, type Role } from './api'
import { useGroups } from './useGroups'

// The Group last chosen on this tablet, kept while the browser tab stays open.
const remembered = 'kita.group'

/** In the top bar on every page: which Group the Staff member is working with. A Teacher has their
 * own Groups, an Admin every Group; "All Groups" where there is more than one to choose from.
 * Choosing a Group opens its Today; All Groups opens the start page. */
export default function GroupChoice({ role, openGroupId }: { role: Role; openGroupId: number | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const groups = useGroups()

  // A Group opened some other way (a link, a tile) is the one being worked with now.
  useEffect(() => {
    if (openGroupId !== null) sessionStorage.setItem(remembered, String(openGroupId))
  }, [openGroupId])

  if (!groups) return null
  const offered = role === 'admin' ? groups : groups.filter((group) => group.mine)
  if (offered.length === 0) return null
  const offersAll = role === 'admin' || offered.length > 1

  const stored = sessionStorage.getItem(remembered)
  const isOffered = (id: string | null) => offered.some((group) => String(group.id) === id)
  const value =
    openGroupId !== null ? String(openGroupId) : isOffered(stored) || (stored === 'all' && offersAll) ? stored! : offersAll ? 'all' : String(offered[0].id)

  function choose(choice: string) {
    sessionStorage.setItem(remembered, choice)
    navigate(choice === 'all' ? '/' : `/groups/${choice}`)
  }

  return (
    <label className="group-choice">
      {t('currentGroup')}
      <select value={value} onChange={(event) => choose(event.target.value)}>
        {offersAll && <option value="all">{t('allGroups')}</option>}
        {offered.map((group) => (
          <option key={group.id} value={String(group.id)}>
            {groupIcons[group.icon]} {group.name}
          </option>
        ))}
      </select>
    </label>
  )
}
