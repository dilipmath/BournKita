// Where the Group last chosen on this tablet is kept, while the browser tab stays open.
const CHOSEN_GROUP_KEY = 'kita.group'
// The choice for the whole Kita rather than one Group; any other choice is a Group's ID.
export const ALL_GROUPS = 'all'

/** The Group last chosen in the top bar on this tablet, if any. */
export function lastChosenGroup(): string | null {
  return sessionStorage.getItem(CHOSEN_GROUP_KEY)
}

/** Keeps the choice for the next page and the next visit to the Children list. */
export function rememberChosenGroup(choice: string): void {
  sessionStorage.setItem(CHOSEN_GROUP_KEY, choice)
}

/** Whose Children the Children list shows: the Group in its address (?group=), else the one last
 * chosen in the top bar; either only if it is All Groups or one of `groups`. Else all. */
export function childrenListChoice(inAddress: string | null, groups: { id: number }[], lastChosen: string | null): string {
  const isOffered = (choice: string | null): choice is string =>
    choice === ALL_GROUPS || groups.some((group) => String(group.id) === choice)
  if (isOffered(inAddress)) return inAddress
  return isOffered(lastChosen) ? lastChosen : ALL_GROUPS
}
