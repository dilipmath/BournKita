import { useTranslation } from 'react-i18next'
import type { Problem } from './profileChange'

/** Says what went wrong, if anything. */
export default function ProblemAlert({ problem }: { problem: Problem }) {
  const { t } = useTranslation()
  if (!problem) return null
  return (
    <p className="status status-problem" role="alert">
      {t(problem)}
    </p>
  )
}
