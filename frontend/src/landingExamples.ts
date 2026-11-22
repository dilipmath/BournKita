import type { ChildSymbol, GroupColour } from './api'

// Invented Children for the Landing page: never a Kita's own.
type ExampleChild = { name: string; symbol: ChildSymbol; colour: GroupColour }

/** The name tags hanging on the hero's rail. */
export const railTags: ExampleChild[] = [
  { name: 'Mia', symbol: 'apple', colour: 'orange' },
  { name: 'Sophie', symbol: 'flower', colour: 'lilac' },
  { name: 'Elias', symbol: 'leaf', colour: 'green' },
  { name: 'Noah', symbol: 'star', colour: 'orange' },
  { name: 'Luca', symbol: 'cloud', colour: 'lilac' },
  { name: 'Mila', symbol: 'fish', colour: 'green' },
  { name: 'Lina', symbol: 'sun', colour: 'orange' },
]

/** Where an example Child is in their day, in the Attendance words of the app. */
export type ExampleAttendance = 'notYet' | 'here' | 'gone'

const startsHere = new Set(['Mia', 'Sophie', 'Luca'])

/** The Children to try the Attendance demo with (the rail's first six), and how each starts. */
export const exampleChildren: (ExampleChild & { attendance: ExampleAttendance })[] = railTags
  .slice(0, 6)
  .map((child) => ({ ...child, attendance: startsHere.has(child.name) ? 'here' : 'notYet' }))
