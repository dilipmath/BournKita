import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation, useMatch, useSearchParams } from 'react-router-dom'
import AlertMarker from './AlertMarker'
import { fetchChildren, type ListedChild, type ListedGroup } from './api'
import { ALL_GROUPS, childrenListChoice, lastChosenGroup } from './chosenGroup'
import GroupLabel from './GroupLabel'
import Icon from './Icon'
import NameTag from './NameTag'
import { useGroups } from './useGroups'

/** The list of Children as name tags (rows on a phone), by Group, those in none last; searchable
 * by name and filtered by the Group chosen in the top bar. A Child's profile opens as a drawer
 * over it (the nested route), so the list stays where it was. Admins also get Add Child. */
export default function ChildrenPage({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation()
  const location = useLocation()
  // Set after archiving a Child profile, or deleting a Parent's data for good, so the list can say what
  // happened.
  const notice = location.state as { archived?: string; deletedPermanently?: string } | null
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const groups = useGroups()
  // Known once the Groups are: until then, which Group is chosen cannot be checked.
  const choice = groups === undefined ? undefined : childrenListChoice(searchParams.get('group'), groups, lastChosenGroup())
  const groupId = choice === undefined || choice === ALL_GROUPS ? null : Number(choice)
  const [children, setChildren] = useState<ListedChild[] | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  // Bumped when a profile closes: it may have changed or archived its Child, or their Alerts.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (choice === undefined) return
    // Answers to earlier keystrokes may arrive late; only the latest search counts.
    let latest = true
    // A pause in typing first: each answer with Alerts is logged as a view of them.
    const timer = window.setTimeout(
      () =>
        fetchChildren(search, groupId, true)
          .then((result) => {
            if (!latest) return
            setChildren(result)
            setFailed(false)
          })
          .catch(() => latest && setFailed(true)),
      search === '' ? 0 : 250,
    )
    return () => {
      latest = false
      window.clearTimeout(timer)
    }
  }, [search, groupId, choice, version])

  // Back from a profile: to that Child's tag, so the keyboard keeps its place in the list.
  const openId = useMatch('/children/:id')?.params.id
  const lastOpen = useRef(openId)
  useEffect(() => {
    if (lastOpen.current !== undefined && openId === undefined) {
      document.querySelector<HTMLElement>(`[data-child-id="${lastOpen.current}"]`)?.focus()
      setVersion((current) => current + 1)
    }
    lastOpen.current = openId
  }, [openId])

  return (
    <section className="page children-page">
      <div className="page-head">
        <h2>{t('children')}</h2>
        {canEdit && (
          <Link className="button primary" to="/children/new">
            {t('newChildProfile')}
          </Link>
        )}
      </div>
      {notice?.archived && (
        <p className="status status-ok" role="status">
          {t('childArchived', { name: notice.archived })}
        </p>
      )}
      {notice?.deletedPermanently && (
        <p className="status status-ok" role="status">
          {t('parentDataDeleted', { name: notice.deletedPermanently })}
        </p>
      )}
      <label>
        {t('searchByName')}
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      {failed && (
        <p className="status status-problem" role="alert">
          {t('somethingWentWrong')}
        </p>
      )}
      {children === undefined ? (
        !failed && <p>{t('loading')}</p>
      ) : children.length === 0 ? (
        <p>{t('noChildrenFound')}</p>
      ) : (
        <ChildrenByGroup listed={children} groups={groups ?? []} query={location.search} />
      )}
      <Outlet />
    </section>
  )
}

// query: the list's address query (its Group), kept in each profile's address.
type ByGroupProps = { listed: ListedChild[]; groups: ListedGroup[]; query: string }

/** A section per Group with Children in the list, then No Group; one plain list without Groups. */
function ChildrenByGroup({ listed, groups, query }: ByGroupProps) {
  const { t } = useTranslation()
  if (groups.length === 0) return <ChildTags items={listed} query={query} />
  const known = new Set(groups.map((group) => group.id))
  const inNone = listed.filter((child) => child.groupId === null || !known.has(child.groupId))
  return (
    <>
      {groups.map((group) => {
        const members = listed.filter((child) => child.groupId === group.id)
        return (
          members.length > 0 && (
            <GroupSection key={group.id} title={<GroupLabel group={group} />}>
              <ChildTags items={members} group={group} query={query} />
            </GroupSection>
          )
        )
      })}
      {inNone.length > 0 && (
        <GroupSection title={t('noGroup')}>
          <ChildTags items={inNone} query={query} />
        </GroupSection>
      )}
    </>
  )
}

function GroupSection({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  const headingId = useId()
  return (
    <section className="children-group" aria-labelledby={headingId}>
      <h3 id={headingId}>{title}</h3>
      {children}
    </section>
  )
}

type TagsProps = { items: ListedChild[]; group?: ListedGroup; query: string }

function ChildTags({ items, group, query }: TagsProps) {
  return (
    <ul className="children-tags">
      {items.map((child) => (
        <ChildTag key={child.id} child={child} group={group} query={query} />
      ))}
    </ul>
  )
}

/** A Child's tag: a link to their profile, named by their full name, with their Alerts on it. */
function ChildTag({ child, group, query }: { child: ListedChild; group?: ListedGroup; query: string }) {
  const { t } = useTranslation()
  const alertId = useId()
  const name = `${child.firstName} ${child.lastName}`
  const alerts = child.alerts ?? []
  return (
    <li className="child-tag">
      <Link to={`/children/${child.id}${query}`} aria-label={name} aria-describedby={alerts.length > 0 ? alertId : undefined} data-child-id={child.id}>
        <NameTag name={name} symbol={child.symbol} colour={group?.colour}>
          {/* On a phone's row, where no Group heading is beside it. */}
          {group && <span className="name-tag-group">{group.name}</span>}
          {alerts.length > 0 && (
            <span className="tag-alert" id={alertId}>
              <AlertMarker label={t('alertsMarker')} alerts={alerts} />
            </span>
          )}
        </NameTag>
      </Link>
      {alerts.length > 0 && (
        <span className="tag-flag" aria-hidden="true">
          <Icon name="alert" />
        </span>
      )}
    </li>
  )
}
