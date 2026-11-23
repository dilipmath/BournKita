import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { fetchParent } from './api'
import Icon from './Icon'
import NameTag from './NameTag'
import Panel from './Panel'
import ParentContacts from './ParentContacts'
import ParentDataRequests from './ParentDataRequests'
import ParentForm from './ParentForm'
import { useRecordAtAddress } from './recordAtAddress'
import RecordPlaceholder from './RecordPlaceholder'

/** A Parent with their contact details and all their Children (as name tags), in the panels of the
 * Child profile. Admins can edit it, and answer the Parent's Data-subject requests here. */
export default function ParentPage({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation()
  const [loaded] = useRecordAtAddress(fetchParent)
  const parent = loaded.record
  if (!parent) return <RecordPlaceholder {...loaded} />

  return (
    <section className="page parent-page">
      <header className="profile-head">
        <span className="profile-symbol">
          <Icon name="person" />
        </span>
        <h2>
          {parent.firstName} {parent.lastName}
        </h2>
        {canEdit && (
          <Link className="button primary" to={`/parents/${parent.id}/edit`}>
            {t('edit')}
          </Link>
        )}
      </header>
      <Panel icon="person" title={t('contactDetails')}>
        <ParentContacts parent={parent} />
      </Panel>
      <Panel icon="children" title={t('children')}>
        <ul className="children-tags">
          {parent.children.map((child) => (
            <li key={child.id} className="child-tag">
              <Link to={`/children/${child.id}`} aria-label={`${child.firstName} ${child.lastName}`}>
                <NameTag name={`${child.firstName} ${child.lastName}`} symbol={child.symbol} />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
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
