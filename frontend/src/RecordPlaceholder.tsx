import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Loaded } from './recordAtAddress'

/** Stands in for a record that is loading, failed to load or does not exist. */
export default function RecordPlaceholder<T>({ record, failed, backTo }: Loaded<T> & { backTo?: { to: string; label: string } }) {
  const { t } = useTranslation()
  if (failed) {
    return (
      <p className="status status-problem" role="alert">
        {t('somethingWentWrong')}
      </p>
    )
  }
  if (record === null) {
    return (
      <section className="page">
        <p className="status status-problem">{t('notFound')}</p>
        {backTo && <Link to={backTo.to}>{backTo.label}</Link>}
      </section>
    )
  }
  return <p>{t('loading')}</p>
}
