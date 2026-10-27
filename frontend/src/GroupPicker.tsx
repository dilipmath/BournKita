import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import GroupOptions from './GroupOptions'
import { useGroups } from './useGroups'

// Where this tablet remembers the Group last picked: tablets usually stay in one Group.
const LAST_GROUP = 'kita.lastGroup'

function lastGroup(): number | null {
  try {
    const stored = localStorage.getItem(LAST_GROUP)
    return stored === null ? null : Number(stored)
  } catch {
    return null // Storage may be blocked; the drop-down still works.
  }
}

function remember(groupId: number) {
  try {
    localStorage.setItem(LAST_GROUP, String(groupId))
  } catch {
    // Not remembered, then.
  }
}

/** The start page's drop-down that takes a Staff member to a Group dashboard in one tap: their own
 * Groups first, and the Group last picked on this tablet one link away. */
export default function GroupPicker() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pickerId = useId()
  const groups = useGroups()

  if (!groups || groups.length === 0) return null
  const mine = groups.filter((group) => group.mine)
  const others = groups.filter((group) => !group.mine)
  const remembered = groups.find((group) => group.id === lastGroup())

  // Opens the dashboard as soon as a Group is picked: one tap on a tablet. (With a keyboard,
  // moving through a closed drop-down picks too, so keyboard users open it first.)
  function pick(value: string) {
    if (!value) return
    remember(Number(value))
    navigate(`/groups/${value}`)
  }

  return (
    <section className="group-picker">
      {/* Beside the drop-down, not around it, so the picked option does not join its name. */}
      <label htmlFor={pickerId}>{t('group')}</label>
      <select id={pickerId} value="" onChange={(event) => pick(event.target.value)}>
        <option value="">{t('chooseGroup')}</option>
        {mine.length > 0 ? (
          <>
            <optgroup label={t('myGroups')}>
              <GroupOptions groups={mine} />
            </optgroup>
            {others.length > 0 && (
              <optgroup label={t('otherGroups')}>
                <GroupOptions groups={others} />
              </optgroup>
            )}
          </>
        ) : (
          <GroupOptions groups={groups} />
        )}
      </select>
      {remembered && (
        <Link className="button primary" to={`/groups/${remembered.id}`}>
          {t('openGroup', { name: remembered.name })}
        </Link>
      )}
    </section>
  )
}
