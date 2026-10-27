import { groupIcons, type GroupDetails } from './api'

/** A Group's icon and name; the icon is decoration, so the Group is named by its name alone. */
export default function GroupLabel({ group }: { group: GroupDetails }) {
  return (
    <>
      <span aria-hidden="true">{groupIcons[group.icon]}</span> {group.name}
    </>
  )
}
