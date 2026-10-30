import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { fetchParent } from './api'
import ParentContacts from './ParentContacts'
import ParentDataRequests from './ParentDataRequests'
import ParentForm from './ParentForm'
import { useRecordAtAddress } from './recordAtAddress'
import RecordPlaceholder from './RecordPlaceholder'

/** A Parent with their contact details and all their Children. Admins can edit it. */
export default function ParentPage({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation()
  const [loaded] = useRecordAtAddress(fetchParent)
  const parent = loaded.record
  if (!parent) return <RecordPlaceholder {...loaded} />

  return (
    <section className="page profile">
      <h2>
        {parent.firstName} {parent.lastName}
      </h2>
      <ParentContacts parent={parent} />
      <h3>{t('children')}</h3>
      <ul className="children-list">
        {parent.children.map((child) => (
          <li key={child.id}>
            <Link to={`/children/${child.id}`}>
              {child.firstName} {child.lastName}
            </Link>
          </li>
        ))}
      </ul>
      {canEdit && (
        <Link className="button primary" to={`/parents/${parent.id}/edit`}>
          {t('edit')}
        </Link>
      )}
      {canEdit && <ParentDataRequests key={parent.id} parent={parent} />}
    </section>
  )
}

/** The form for changing the Parent named by the address. Admins only. */
export function ParentEditPage() {
  const navigate = useNavigate()
  const [loaded] = useRecordAtAddress(fetchParent)
  const parent = loaded.record
  if (!parent) return <RecordPlaceholder {...loaded} />
  return (
    <ParentForm
      key={parent.id}
      parent={parent}
      heading="editParent"
      submitLabel="save"
      onSaved={(saved) => navigate(`/parents/${saved.id}`)}
    />
  )
}
