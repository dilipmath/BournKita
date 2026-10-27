import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { putChildInGroup, type ChildProfile } from './api'
import GroupLabel from './GroupLabel'
import GroupOptions from './GroupOptions'
import ProblemAlert from './ProblemAlert'
import { useProfileChange } from './profileChange'
import { useGroups } from './useGroups'

type Props = { child: ChildProfile; canEdit: boolean; reload: () => void }

/** The Group a Child is in, as a definition on the profile; Admins move the Child here. */
export default function ChildGroup({ child, canEdit, reload }: Props) {
  const { t } = useTranslation()
  const { problem, change } = useProfileChange(reload)
  // Only Admins choose from them.
  const groups = useGroups(canEdit)

  if (!canEdit) {
    return (
      <>
        <dt>{t('group')}</dt>
        <dd>
          {child.group ? (
            <Link to={`/groups/${child.group.id}`}>
              <GroupLabel group={child.group} />
            </Link>
          ) : (
            t('noGroup')
          )}
        </dd>
      </>
    )
  }
  return (
    <>
      <dt>{t('group')}</dt>
      <dd>
        <select
          aria-label={t('group')}
          value={child.group?.id ?? ''}
          disabled={groups === undefined}
          onChange={(event) => void change(() => putChildInGroup(child.id, event.target.value ? Number(event.target.value) : null))}
        >
          <option value="">{t('noGroup')}</option>
          {/* Until the Groups load, the Child's own keeps the drop-down showing it. */}
          <GroupOptions groups={groups ?? (child.group ? [child.group] : [])} />
        </select>
        <ProblemAlert problem={problem} />
      </dd>
    </>
  )
}
