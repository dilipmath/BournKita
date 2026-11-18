import { useTranslation } from 'react-i18next'
import { groupIcons } from './api'
import Icon from './Icon'

// Invented, round numbers: never a Kita's own.
const stats = [
  { label: 'sampleChildren', value: 48, note: 'sampleChildrenNote' },
  { label: 'sampleStaff', value: 12, note: 'sampleStaffNote' },
  { label: 'sampleGroups', value: 4, note: 'sampleGroupsNote' },
] as const

const groups = [
  { name: 'sampleBears', icon: 'bear', children: 12 },
  { name: 'sampleFoxes', icon: 'fox', children: 10 },
  { name: 'sampleBunnies', icon: 'rabbit', children: 14 },
] as const

const team = [
  { name: 'sampleTeacherA', role: 'roleTeacher', group: 'sampleBears' },
  { name: 'sampleTeacherB', role: 'roleTeacher', group: 'sampleFoxes' },
  { name: 'sampleAdminC', role: 'roleAdmin', group: 'sampleWholeKita' },
] as const

/** What a day in BournKita looks like, with invented Groups and Staff. A picture only: hidden from
 * screen readers, so nobody hears made-up numbers as if they were the Kita's. */
export default function SampleDay() {
  const { t } = useTranslation()
  return (
    <div className="sample-day" aria-hidden="true">
      <div className="sample-blob" />
      <p className="sample-note sample-note-top">
        <Icon name="today" />
        {t('sampleNoteTop')}
      </p>
      <div className="sample-board">
        <div className="sample-head">
          <strong>{t('sampleGreeting')}</strong>
          <span className="sample-example">{t('sampleExample')}</span>
        </div>
        <div className="sample-stats">
          {stats.map(({ label, value, note }) => (
            <div key={label}>
              <small>{t(label)}</small>
              <b>{value}</b>
              <em>{t(note)}</em>
            </div>
          ))}
        </div>
        <p className="sample-label">{t('sampleYourGroups')}</p>
        <div className="sample-groups">
          {groups.map(({ name, icon, children }) => (
            <div key={name}>
              <span className="sample-group-icon">{groupIcons[icon]}</span>
              <b>{t(name)}</b>
              <small>{t('sampleChildCount', { count: children })}</small>
            </div>
          ))}
        </div>
        <p className="sample-label">{t('sampleTeam')}</p>
        {team.map(({ name, role, group }) => (
          <div key={name} className="sample-person">
            <span className="sample-face">
              <Icon name="person" />
            </span>
            <span>
              <b>{t(name)}</b>
              <small>
                {t(role)} · {t(group)}
              </small>
            </span>
            <span className="sample-status">{t('sampleActive')}</span>
          </div>
        ))}
      </div>
      <p className="sample-note sample-note-bottom">
        <Icon name="here" />
        {t('sampleNoteBottom')}
      </p>
    </div>
  )
}
