import { groupIcons, type GroupDetails } from './api'

/** A Group's colour, icon and name; colour and icon are decoration, so the Group is named by its
 * name alone, and the colour never says anything on its own. */
export default function GroupLabel({ group }: { group: GroupDetails }) {
  return (
    <>
      {group.colour && <span className={`group-dot group-colour-${group.colour}`} aria-hidden="true" />}
      <span aria-hidden="true">{groupIcons[group.icon]}</span> {group.name}
    </>
  )
}
