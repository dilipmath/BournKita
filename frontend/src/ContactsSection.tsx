import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addContact, removeContact, updateContact, type Contact, type ContactKind, type LinkedParent } from './api'
import ContactForm from './ContactForm'
import PickUpPhoto from './PickUpPhoto'
import Phone from './Phone'
import ProblemAlert from './ProblemAlert'
import { useProfileChange } from './profileChange'

const texts = {
  emergency: { heading: 'emergencyContacts', empty: 'noEmergencyContacts', add: 'addEmergencyContact' },
  pickUp: { heading: 'whoMayPickUp', empty: 'nobodyMayPickUp', add: 'addPickUpPerson' },
} as const

type Props = {
  kind: ContactKind
  childId: number
  contacts: Contact[]
  /** For Pick-up persons: the Child's Parents, listed first if they may pick up. */
  parents?: LinkedParent[]
  canEdit: boolean
  reload: () => void
}

/** A Child's Emergency contacts or Pick-up persons; Admins add, change and remove them here. */
export default function ContactsSection({ kind, childId, contacts, parents = [], canEdit, reload }: Props) {
  const { t } = useTranslation()
  const { problem, change } = useProfileChange(reload)
  // The contact being changed, or 'new' while one is added.
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const text = texts[kind]
  const headingId = `${kind}-heading`
  const parentsListed = parents.filter((parent) => parent.mayPickUp)
  const noPhone = t('noPhone')

  async function save(call: () => Promise<unknown>) {
    const saved = await change(call)
    if (saved) setEditing(null)
    return saved
  }

  return (
    <section className="contacts" aria-labelledby={headingId}>
      <h3 id={headingId}>{t(text.heading)}</h3>
      {parentsListed.length + contacts.length === 0 ? (
        <p>{t(text.empty)}</p>
      ) : (
        <ul>
          {parentsListed.map((parent) => (
            <li key={`parent-${parent.id}`} className="contact">
              <PickUpPhoto
                of={{ parentId: parent.id }}
                photoId={parent.photoId}
                name={`${parent.firstName} ${parent.lastName}`}
                canEdit={canEdit}
                change={change}
              />
              <strong>
                {parent.firstName} {parent.lastName}
              </strong>
              <span> ({t('parent')})</span>
              <div>
                <Phone number={parent.phone} missing={noPhone} />
              </div>
            </li>
          ))}
          {contacts.map((contact) =>
            editing === contact.id ? (
              <li key={contact.id}>
                <ContactForm
                  label={t('changeNamed', { name: contact.name })}
                  contact={contact}
                  onSave={(details) => save(() => updateContact(childId, contact.id, { kind, ...details }))}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={contact.id} className="contact">
                {/* Checked at pick-up; whom to call needs none. */}
                {kind === 'pickUp' && (
                  <PickUpPhoto
                    of={{ childId, contactId: contact.id }}
                    photoId={contact.photoId}
                    name={contact.name}
                    canEdit={canEdit}
                    change={change}
                  />
                )}
                <strong>{contact.name}</strong>
                {contact.relationship && <span> ({contact.relationship})</span>}
                <div>
                  <Phone number={contact.phone} missing={noPhone} />
                </div>
                {contact.note && <p className="note">{contact.note}</p>}
                {canEdit && (
                  <div className="actions">
                    <button type="button" onClick={() => setEditing(contact.id)}>
                      {t('changeNamed', { name: contact.name })}
                    </button>
                    <button type="button" onClick={() => void change(() => removeContact(childId, contact.id))}>
                      {t('removeNamed', { name: contact.name })}
                    </button>
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}
      <ProblemAlert problem={problem} />
      {canEdit &&
        (editing === 'new' ? (
          <ContactForm
            label={t(text.add)}
            onSave={(details) => save(() => addContact(childId, { kind, ...details }))}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <button type="button" onClick={() => setEditing('new')}>
            {t(text.add)}
          </button>
        ))}
    </section>
  )
}
