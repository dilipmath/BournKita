import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { recordConsent, type ConsentChange, type ConsentPeriod, type Consents, type ConsentType } from './api'
import { kitaToday, localDate } from './dates'
import ProblemAlert from './ProblemAlert'
import { useProfileChange } from './profileChange'

// Each Consent's translation key, in the order the profile lists them.
const consentLabel = {
  photo: 'consentPhoto',
  excursion: 'consentExcursion',
  dataProtection: 'consentDataProtection',
} as const

type EndedPeriod = ConsentPeriod & { withdrawnOn: string }

type Props = { childId: number; consents: Consents; canEdit: boolean; reload: () => void }

/** What a Child's Parents allowed, and since when; Admins record givings and withdrawals. */
export default function ConsentsSection({ childId, consents, canEdit, reload }: Props) {
  const { t, i18n } = useTranslation()
  const { problem, change } = useProfileChange(reload)
  // The Consent whose giving or withdrawal is being recorded.
  const [recording, setRecording] = useState<ConsentType | null>(null)
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })

  function formatted(date: string) {
    return dateFormat.format(localDate(date))
  }

  async function save(consent: ConsentType, consentChange: ConsentChange, on: string) {
    const saved = await change(() => recordConsent(childId, consent, consentChange, on))
    if (saved) setRecording(null)
    return saved
  }

  return (
    <section className="consents" aria-labelledby="consents-heading">
      <h3 id="consents-heading">{t('consents')}</h3>
      <ul>
        {(Object.keys(consentLabel) as ConsentType[]).map((consent) => {
          const periods = consents[consent]
          const current = periods.at(-1)
          const isGiven = current !== undefined && current.withdrawnOn === null
          // Every period that has ended, so a withdrawal keeps the date it was given on.
          const ended = periods.filter((period): period is EndedPeriod => period.withdrawnOn !== null)
          const name = t(consentLabel[consent])
          const status = !current
            ? t('consentNotGiven')
            : current.withdrawnOn === null
              ? t('consentGivenSince', { date: formatted(current.givenOn) })
              : t('consentWithdrawnOn', { date: formatted(current.withdrawnOn) })
          const nextChange: ConsentChange = isGiven ? 'withdrawn' : 'given'
          const action = t(isGiven ? 'recordWithdrawal' : 'recordGiving', { consent: name })
          return (
            <li key={consent} className="consent">
              <p>
                <strong>{name}</strong>: {status}
              </p>
              {ended.length > 0 && (
                <p className="history">
                  {t('consentHistory')}{' '}
                  {ended
                    .map((period) =>
                      t('consentPeriod', { given: formatted(period.givenOn), withdrawn: formatted(period.withdrawnOn) }),
                    )
                    .join('; ')}
                </p>
              )}
              {canEdit &&
                (recording === consent ? (
                  <ConsentForm
                    label={action}
                    change={nextChange}
                    onSave={(on) => save(consent, nextChange, on)}
                    onCancel={() => setRecording(null)}
                  />
                ) : (
                  <button type="button" onClick={() => setRecording(consent)}>
                    {action}
                  </button>
                ))}
            </li>
          )
        })}
      </ul>
      <ProblemAlert problem={problem} />
    </section>
  )
}

type FormProps = { label: string; change: ConsentChange; onSave: (on: string) => Promise<boolean>; onCancel: () => void }

/** Asks for the date of a giving or withdrawal, today at the Kita unless the Admin says otherwise. */
function ConsentForm({ label, change, onSave, onCancel }: FormProps) {
  const { t } = useTranslation()
  const [on, setOn] = useState(kitaToday)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    if (!(await onSave(on))) setSubmitting(false)
  }

  return (
    <form className="consent-form" aria-label={label} onSubmit={(event) => void submit(event)}>
      <label>
        {t(change === 'given' ? 'givenOn' : 'withdrawnOn')}
        <input type="date" required max={kitaToday()} value={on} onChange={(event) => setOn(event.target.value)} />
      </label>
      <div className="actions">
        <button type="submit" className="primary" disabled={submitting}>
          {t('save')}
        </button>
        <button type="button" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
