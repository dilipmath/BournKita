import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { GroupDay } from './api'
import GroupLabel from './GroupLabel'
import Icon from './Icon'

/** A Group's tile: its day in numbers; a tap opens its Today view. On the Kita overview and
 * a Teacher's start page. */
export default function GroupDayTile({ group }: { group: GroupDay }) {
  const { t } = useTranslation()
  const fullName = (child: { firstName: string; lastName: string }) => `${child.firstName} ${child.lastName}`
  return (
    <li>
      <Link className="group-tile" to={`/groups/${group.id}`}>
        <strong className="group-tile-name">
          <GroupLabel group={group} />
        </strong>
        {group.expected === 0 ? (
          <span>{t('noChildrenInGroup')}</span>
        ) : (
          <>
            <span>{t('todayCounts', { here: group.here, gone: group.gone, absent: group.absent, notYet: group.notYet })}</span>
            {group.alertsHere > 0 && (
              <span className="group-tile-alerts">
                <Icon name="alert" />
                {t('withAlertsHere', { count: group.alertsHere })}
              </span>
            )}
          </>
        )}
        {group.birthdays.length > 0 && (
          <span>
            <Icon name="birthday" />
            {t('birthdayToday', { names: group.birthdays.map(fullName).join(', ') })}
          </span>
        )}
      </Link>
    </li>
  )
}
