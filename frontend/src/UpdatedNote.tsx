import { useTranslation } from 'react-i18next'
import { kitaTime } from './dates'

/** When the numbers on the page are from, and whether the last refresh failed. */
export default function UpdatedNote({ updatedAt, stale }: { updatedAt: string | null; stale: boolean }) {
  const { t, i18n } = useTranslation()
  if (updatedAt === null) return null
  const time = kitaTime(updatedAt, i18n.language)
  return (
    <p className={stale ? 'updated-note status-problem' : 'updated-note'} role={stale ? 'status' : undefined}>
      {t(stale ? 'couldNotUpdate' : 'updatedAt', { time })}
    </p>
  )
}
