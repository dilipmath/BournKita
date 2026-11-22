import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import NameTag from './NameTag'
import { exampleChildren, type ExampleAttendance } from './landingExamples'
import { useToast } from './toastContext'

// Each step of the example day: where the next tap leads, the tag's label and the toast.
const steps = {
  notYet: { after: 'here', label: 'notHereYet', toast: 'demoToastNotYet' },
  here: { after: 'gone', label: 'demoHere', toast: 'demoToastHere' },
  gone: { after: 'notYet', label: 'demoGone', toast: 'demoToastGone' },
} as const satisfies Record<ExampleAttendance, { after: ExampleAttendance; label: string; toast: string }>

/** The Landing page's board to try check-in on, with invented Children: each tap moves a tag
 * on (not here yet, here, gone home), with a toast to undo it. Held in the page only: nothing is
 * saved or sent to the server. */
export default function AttendanceDemo() {
  const { t } = useTranslation()
  const toast = useToast()
  const [attendance, setAttendance] = useState(() => exampleChildren.map((child) => child.attendance))
  const here = attendance.filter((each) => each === 'here').length

  function tap(index: number) {
    const before = attendance[index]
    const after = steps[before].after
    const setAttendanceOf = (value: ExampleAttendance) =>
      setAttendance((current) => current.map((old, i) => (i === index ? value : old)))
    setAttendanceOf(after)
    toast(t(steps[after].toast, { name: exampleChildren[index].name }), () => setAttendanceOf(before))
  }

  return (
    <div className="landing-board">
      <p className="landing-example">{t('example')}</p>
      <ul>
        {exampleChildren.map((child, index) => (
          <li key={child.name}>
            <button type="button" className={`demo-tag ${attendance[index]}`} onClick={() => tap(index)}>
              <NameTag name={child.name} symbol={child.symbol} colour={child.colour}>
                <span className="name-tag-state">{t(steps[attendance[index]].label)}</span>
              </NameTag>
            </button>
          </li>
        ))}
      </ul>
      <p className="landing-count">
        <span className="count">{t('demoCount', { here, total: exampleChildren.length })}</span>
        <small>{t('demoHint')}</small>
      </p>
    </div>
  )
}
