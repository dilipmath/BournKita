import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMatch, useNavigate, useSearchParams } from 'react-router-dom'
import { groupIcons, type ListedGroup, type Role } from './api'
import { ALL_GROUPS, childrenListChoice, lastChosenGroup, rememberChosenGroup } from './chosenGroup'
import { useGroups } from './useGroups'

/** Which Group the drop-down shows: the one whose pages are open, else the one last chosen if it is
 * still offered, else All Groups where offered, else the only Group. */
function shownChoice(offered: ListedGroup[], offersAll: boolean, openGroupId: number | null, lastChosen: string | null): string {
  if (openGroupId !== null) return String(openGroupId)
  if (offered.some((group) => String(group.id) === lastChosen)) return lastChosen!
  if (lastChosen === ALL_GROUPS && offersAll) return ALL_GROUPS
  return offersAll ? ALL_GROUPS : String(offered[0].id)
}

/** In the top bar on every page: which Group the Staff member is working with. A Teacher has their
 * own Groups, an Admin every Group; "All Groups" where there is more than one to choose from.
 * Choosing a Group opens its Today; All Groups opens the start page. On the Children list, it
 * filters the list instead (every Staff member sees every Child, so All Groups is offered there). */
export default function GroupChoice({ role, openGroupId }: { role: Role; openGroupId: number | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const groups = useGroups()
  const onChildren = useMatch('/children/*') !== null
  const [searchParams] = useSearchParams()
  const [lastChosen, setLastChosen] = useState(lastChosenGroup)

  // A Group opened some other way (a link, a tile) is the one being worked with now.
  if (openGroupId !== null && String(openGroupId) !== lastChosen) setLastChosen(String(openGroupId))
  useEffect(() => {
    if (lastChosen !== null) rememberChosenGroup(lastChosen)
  }, [lastChosen])

  if (!groups) return null
  const offered = role === 'admin' ? groups : groups.filter((group) => group.mine)
  if (offered.length === 0) return null
  const offersAll = onChildren || role === 'admin' || offered.length > 1

  function choose(choice: string) {
    setLastChosen(choice)
    if (onChildren) navigate(`/children?group=${choice}`)
    else navigate(choice === ALL_GROUPS ? '/' : `/groups/${choice}`)
  }

  const shown = onChildren
    ? childrenListChoice(searchParams.get('group'), offered, lastChosen)
    : shownChoice(offered, offersAll, openGroupId, lastChosen)
  const shownGroup = offered.find((group) => String(group.id) === shown)

  return (
    <label className={shownGroup ? `group-choice group-colour-${shownGroup.colour}` : 'group-choice'}>
      {t('currentGroup')}
      <select value={shown} onChange={(event) => choose(event.target.value)}>
        {offersAll && <option value={ALL_GROUPS}>{t('allGroups')}</option>}
        {offered.map((group) => (
          <option key={group.id} value={String(group.id)}>
            {groupIcons[group.icon]} {group.name}
          </option>
        ))}
      </select>
    </label>
  )
}
