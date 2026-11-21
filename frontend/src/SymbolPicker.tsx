import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { childSymbols, type ChildSymbol as SymbolName } from './api'
import ChildSymbol from './ChildSymbol'

type Props = {
  value: SymbolName
  onChange: (symbol: SymbolName) => void
  /** The Symbols other Children in the Group have: marked, since choosing one is refused. */
  taken?: ReadonlySet<SymbolName>
}

/** Choosing a Child's Symbol, as on their coat hook: each picture a radio button named by it.
 * Another Child in the same Group may not have the one chosen; the server says so. */
export default function SymbolPicker({ value, onChange, taken = new Set() }: Props) {
  const { t } = useTranslation()
  const labelId = useId()
  const name = useId()
  return (
    <div className="symbols" role="radiogroup" aria-labelledby={labelId}>
      <span id={labelId} className="symbols-label">
        {t('symbol')}
      </span>
      {childSymbols.map((option) => (
        <label key={option} className={taken.has(option) ? 'taken' : undefined}>
          <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} />
          <ChildSymbol symbol={option} />
          <span className="visually-hidden">{taken.has(option) ? t('symbolTakenInGroup', { name: t(`symbol_${option}`) }) : t(`symbol_${option}`)}</span>
        </label>
      ))}
    </div>
  )
}
