import { groupIcons, type Group } from './api'

/** The Groups as options of a drop-down, each with its icon (options can hold text only). */
export default function GroupOptions({ groups }: { groups: Group[] }) {
  return groups.map((group) => (
    <option key={group.id} value={group.id}>
      {`${groupIcons[group.icon]} ${group.name}`}
    </option>
  ))
}
