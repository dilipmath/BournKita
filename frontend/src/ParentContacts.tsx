import { useTranslation } from 'react-i18next'
import type { Parent } from './api'

/** A Parent's address, phone and email, the phone and email tappable on a tablet. */
export default function ParentContacts({ parent }: { parent: Parent }) {
  const { t } = useTranslation()
  return (
    <dl>
      <dt>{t('address')}</dt>
      <dd className="address">{parent.address || '–'}</dd>
      <dt>{t('phone')}</dt>
      <dd>{parent.phone ? <a href={`tel:${parent.phone.replace(/[^+\d]/g, '')}`}>{parent.phone}</a> : '–'}</dd>
      <dt>{t('emailAddress')}</dt>
      <dd>{parent.email ? <a href={`mailto:${parent.email}`}>{parent.email}</a> : '–'}</dd>
    </dl>
  )
}
