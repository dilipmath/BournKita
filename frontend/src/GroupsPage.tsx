import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { fetchGroups, removeGroup, saveGroup, type GroupDetails, type ListedGroup } from './api'
import GroupForm from './GroupForm'
import GroupLabel from './GroupLabel'
import ProblemAlert from './ProblemAlert'
import { useProfileChange } from './profileChange'

/** The Admin-only page where Groups are created, renamed and removed. */
export default function GroupsPage() {
  const { t } = useTranslation()
  const [groups, setGroups] = useState<ListedGroup[]>()
  const [failed, setFailed] = useState(false)
  // The Group being changed, or whose removal is being confirmed.
  const [editing, setEditing] = useState<{ id: number; step: 'change' | 'remove' } | null>(null)

  const load = useCallback(() => {
    fetchGroups()
      .then(setGroups)
      .catch(() => setFailed(true))
  }, [])

  useEffect(load, [load])
  // A change that worked closes its form and shows the Groups as they are now.
  const { problem, change } = useProfileChange(() => {
    setEditing(null)
    load()
  })

  return (
    <section className="page groups">
      <h2>{t('groups')}</h2>
      {groups === undefined ? (
        !failed && <p>{t('loading')}</p>
      ) : groups.length === 0 ? (
        <p>{t('noGroups')}</p>
      ) : (
        <ul>
          {groups.map((group) => (
            <li key={group.id} className="group">
              {editing?.id === group.id && editing.step === 'change' ? (
                <GroupForm
                  label={t('changeNamed', { name: group.name })}
                  submitLabel={t('save')}
                  group={group}
                  onSave={(details: GroupDetails) => change(() => saveGroup(details, group.id))}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <h3>
                    <Link to={`/groups/${group.id}`}>
                      <GroupLabel group={group} />
                    </Link>
                  </h3>
                  {editing?.id === group.id ? (
                    // A second, deliberate step; the Group's Children stay, in no Group.
                    <div className="actions" role="group" aria-label={t('removeNamed', { name: group.name })}>
                      <p>{t('confirmRemoveGroup', { name: group.name })}</p>
                      <button type="button" className="danger" onClick={() => void change(() => removeGroup(group.id))}>
                        {t('removeForGood')}
                      </button>
                      <button type="button" onClick={() => setEditing(null)}>
                        {t('cancel')}
                      </button>
                    </div>
                  ) : (
                    <div className="actions">
                      <button type="button" onClick={() => setEditing({ id: group.id, step: 'change' })}>
                        {t('changeNamed', { name: group.name })}
                      </button>
                      <button type="button" onClick={() => setEditing({ id: group.id, step: 'remove' })}>
                        {t('removeNamed', { name: group.name })}
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <ProblemAlert problem={failed ? 'somethingWentWrong' : problem} />
      <h3>{t('newGroup')}</h3>
      <GroupForm label={t('newGroup')} submitLabel={t('createGroup')} onSave={(details) => change(() => saveGroup(details))} />
    </section>
  )
}
