/** A phone number, tappable on a tablet; `missing` stands in when none is recorded. */
export default function Phone({ number, missing = '–' }: { number: string; missing?: string }) {
  if (!number) return <span>{missing}</span>
  return <a href={`tel:${number.replace(/[^+\d]/g, '')}`}>{number}</a>
}
