import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChildSymbol as SymbolName } from './api'

// The Symbols a Child can have, as line pictures on a 24×24 grid, drawn in the colour of the text
// around them; the same set the API accepts.
const pictures: Record<SymbolName, ReactNode> = {
  apple: (
    <>
      <path d="M12 7c-2-2-7-1.5-7 4 0 4.5 3 9 5 9 1 0 1.3-.6 2-.6s1 .6 2 .6c2 0 5-4.5 5-9 0-5.5-5-6-7-4z" />
      <path d="M12 7c0-2 1-3.5 3-4" />
    </>
  ),
  cloud: <path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18z" />,
  drop: <path d="M12 3c3.5 4.5 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.5 6-11z" />,
  fish: (
    <>
      <path d="M3 12c3-5 10-6 14 0-4 6-11 5-14 0z" />
      <path d="M17 12l4-4v8z" />
      <circle cx="8" cy="11" r="0.8" />
    </>
  ),
  flower: (
    <>
      <circle cx="12" cy="10" r="2.5" />
      <path d="M12 7.5c0-3 3-3 3-.5M14.5 10c3 0 3 3 .5 3M12 12.5c0 3-3 3-3 .5M9.5 10c-3 0-3-3-.5-3M12 12.5V21M12 18c-2-2-4-2-5-1" />
    </>
  ),
  heart: <path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z" />,
  house: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 9.5V20h12V9.5M10 20v-5h4v5" />
    </>
  ),
  kite: (
    <>
      <path d="M14 3l6 6-6 9-6-9z" />
      <path d="M14 3v15M8 9h12M14 18c-1 1.5-3 2-4 1s-3-.5-4 1" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15z" />
      <path d="M5 19l9-9" />
    </>
  ),
  moon: <path d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10z" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </>
  ),
  boat: (
    <>
      <path d="M3 15h18l-3 5H6z" />
      <path d="M12 15V3l6 9h-6M12 6l-5 7h5" />
    </>
  ),
  tree: (
    <>
      <path d="M12 3c4 0 6 3 6 6 0 3.5-2.5 5.5-6 5.5S6 12.5 6 9c0-3 2-6 6-6z" />
      <path d="M12 14.5V21M9 21h6" />
    </>
  ),
  car: (
    <>
      <path d="M3 16v-3l2-5h14l2 5v3z" />
      <circle cx="7.5" cy="17" r="2" />
      <circle cx="16.5" cy="17" r="2" />
      <path d="M5 13h14" />
    </>
  ),
  bell: (
    <>
      <path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z" />
      <path d="M10 21a2 2 0 0 0 4 0M12 3v2" />
    </>
  ),
  ball: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c3 2.5 3 14.5 0 17M12 3.5c-3 2.5-3 14.5 0 17" />
    </>
  ),
  bird: (
    <>
      <path d="M4 14c2 4 9 5 13 1l4-6h-4a4 4 0 0 0-7 1c-2 1-4 3-6 4z" />
      <path d="M10 13c1 2 3 2.5 5 1.5" />
      <circle cx="16" cy="9" r="0.8" />
    </>
  ),
  butterfly: (
    <>
      <path d="M12 7v12" />
      <path d="M12 10C9 4 3 4 4 9c.5 3 4 4 8 3M12 10c3-6 9-6 8-1-.5 3-4 4-8 3M12 13c-3 0-6 2-5 4.5S11 18 12 15M12 13c3 0 6 2 5 4.5S13 18 12 15" />
    </>
  ),
  snail: (
    <>
      <path d="M3 18h15c1.5 0 3-1 3-3" />
      <circle cx="11" cy="12" r="5.5" />
      <path d="M11 12a2.5 2.5 0 1 1 2.5-2.5M17 15l2-7M19.5 8l1-1.5" />
    </>
  ),
  mushroom: (
    <>
      <path d="M3 12a9 7 0 0 1 18 0z" />
      <path d="M9 12v7a3 3 0 0 0 6 0v-7" />
    </>
  ),
  umbrella: (
    <>
      <path d="M3 12a9 9 0 0 1 18 0z" />
      <path d="M12 12v6a2 2 0 0 1-4 0M12 3v1" />
    </>
  ),
  rainbow: <path d="M2 18a10 10 0 0 1 20 0M5.5 18a6.5 6.5 0 0 1 13 0M9 18a3 3 0 0 1 6 0" />,
  key: (
    <>
      <circle cx="7.5" cy="12" r="4" />
      <path d="M11.5 12H21M17 12v3.5M20 12v2.5" />
    </>
  ),
  drum: (
    <>
      <ellipse cx="12" cy="9" rx="8" ry="3" />
      <path d="M4 9v7c0 1.7 3.6 3 8 3s8-1.3 8-3V9M7 4l3 4M17 4l-3 4" />
    </>
  ),
  train: (
    <>
      <rect x="5" y="4" width="14" height="12" rx="3" />
      <path d="M5 11h14M8 20l2-4M16 20l-2-4" />
      <circle cx="9" cy="13.5" r="0.8" />
      <circle cx="15" cy="13.5" r="0.8" />
    </>
  ),
  cherry: (
    <>
      <circle cx="7" cy="17" r="3.5" />
      <circle cx="17" cy="16" r="3.5" />
      <path d="M7 13.5C8 8 11 5 15 3M17 12.5c0-4-1-7-2-9.5M15 3l3 1" />
    </>
  ),
  carrot: (
    <>
      <path d="M15 9L4 20c3-1 9-4 12-7a2.8 2.8 0 0 0-1-4z" />
      <path d="M15 9c0-3 1-5 3-6M15 9c2-1 4-1 6 0M8 16l1.5 1.5M11 13l1.5 1.5" />
    </>
  ),
  cat: (
    <>
      <path d="M5 20v-9l-1-6 4 3h8l4-3-1 6v9z" />
      <circle cx="9.5" cy="13" r="0.8" />
      <circle cx="14.5" cy="13" r="0.8" />
      <path d="M11 16.5h2" />
    </>
  ),
  shell: (
    <>
      <path d="M4 19h16c0-8-3.5-14-8-14S4 11 4 19z" />
      <path d="M12 5v14M8 7l2 12M16 7l-2 12M5.5 12l5.5 7M18.5 12L13 19" />
    </>
  ),
}

/** A Child's Symbol, as on their coat hook, named by its picture. Beside the Child's name it is
 * hidden from screen readers (the name says who it is); `announced` reads it out where the Symbol
 * itself matters. */
export default function ChildSymbol({ symbol, className = '', announced = false }: { symbol: SymbolName; className?: string; announced?: boolean }) {
  const { t } = useTranslation()
  return (
    <svg
      className={`child-symbol ${className}`.trim()}
      viewBox="0 0 24 24"
      role="img"
      aria-label={t(`symbol_${symbol}`)}
      aria-hidden={announced ? undefined : true}
      focusable="false"
    >
      {pictures[symbol]}
    </svg>
  )
}
