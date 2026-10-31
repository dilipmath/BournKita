import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { sendFeedback, type FeedbackKind } from './api'
import ProblemAlert from './ProblemAlert'
import type { Problem } from './profileChange'

const kinds: { kind: FeedbackKind; label: 'feedbackProblem' | 'feedbackChangeRequest' | 'feedbackIdea' }[] = [
  { kind: 'problem', label: 'feedbackProblem' },
  { kind: 'changeRequest', label: 'feedbackChangeRequest' },
  { kind: 'idea', label: 'feedbackIdea' },
]

/** On every page once logged in: where any Staff member (Guests too) tells the developer about a
 * problem, a change they want or an idea. The page they are on goes along. */
export default function FeedbackButton() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const headingId = useId()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<FeedbackKind>('problem')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<Problem>(null)
  const [sent, setSent] = useState(false)
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    // Opened by the button: take keyboard and screen reader users to the form.
    if (open) form.current?.focus()
  }, [open])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSending(true)
    setProblem(null)
    try {
      const result = await sendFeedback(kind, text, pathname)
      if (result === true) {
        setSent(true)
        setOpen(false)
        setText('')
      } else setProblem(result)
    } catch {
      setProblem('somethingWentWrong')
    } finally {
      setSending(false)
    }
  }

  return (
    <aside className="feedback">
      {sent && (
        <p className="status status-ok" role="status">
          {t('feedbackSent')}
        </p>
      )}
      {open ? (
        <form aria-labelledby={headingId} tabIndex={-1} ref={form} onSubmit={(event) => void submit(event)}>
          <h2 id={headingId}>{t('feedback')}</h2>
          <fieldset>
            <legend>{t('feedbackKind')}</legend>
            {kinds.map((each) => (
              <label key={each.kind} className="checkbox">
                <input type="radio" name="feedback-kind" checked={kind === each.kind} onChange={() => setKind(each.kind)} />
                {t(each.label)}
              </label>
            ))}
          </fieldset>
          <label>
            {t('feedbackText')}
            <textarea required maxLength={5000} value={text} onChange={(event) => setText(event.target.value)} />
          </label>
          {/* It leaves the Kita by email. */}
          <p className="hint">{t('feedbackNoNames')}</p>
          <ProblemAlert problem={problem} />
          <div className="actions">
            <button type="submit" className="primary" disabled={sending}>
              {t('sendFeedback')}
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setSent(false)
            setOpen(true)
          }}
        >
          {t('feedback')}
        </button>
      )}
    </aside>
  )
}
