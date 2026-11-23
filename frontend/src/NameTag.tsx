import type { ReactNode } from 'react'
import type { ChildSymbol as SymbolName, GroupColour } from './api'
import ChildSymbol from './ChildSymbol'

// colour: the Group's; left out for a Child in no Group (a plain paper tag).
export type NameTagProps = { name: string; symbol: SymbolName; colour?: GroupColour; children?: ReactNode }

/** A Child as on the cloakroom board: a tag in the Group's colour, with a punched hole, the
 * Symbol and the name; `children` adds what follows the name (e.g. the state). */
export default function NameTag({ name, symbol, colour, children }: NameTagProps) {
  return (
    <span className={colour ? `name-tag group-colour-${colour}` : 'name-tag'}>
      <span className="tag-hole" aria-hidden="true" />
      <ChildSymbol symbol={symbol} className="name-tag-symbol" />
      <span className="name-tag-name">{name}</span>
      {children && <> {children}</>}
    </span>
  )
}
