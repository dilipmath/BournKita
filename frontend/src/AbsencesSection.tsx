import { useTranslation } from 'react-i18next'
import { absenceReasonLabel, removeAbsence, type Absence } from './api'
import { longDay } from './calendarDates'
import ProblemAlert from './ProblemAlert'
import { useProfileChange } from './profileChange'

type Props = { childId: number; absences: Absence[]; reload: () => void }

/** A Child's Absences that have not ended yet, on their profile. Staff record them in the Today
 * view and can remove them here, also those that start later. */
export default function AbsencesSection({ childId, absences, reload }: Props) {
  const { t, i18n } = useTranslation()
  const { problem, change } = useProfileChange(reload)

  return (
    <section className="contacts" aria-labelledby="absences-heading">
      <h3 id="absences-heading">{t('absences')}</h3>
      {absences.length === 0 ? (
        <p>{t('noAbsencesComing')}</p>
      ) : (
        <ul>
          {absences.map((absence) => {
            const from = longDay(absence.startsOn, i18n.language)
            const until = longDay(absence.endsOn, i18n.language)
            return (
              <li key={absence.id} className="contact">
                <strong>{t(absenceReasonLabel[absence.reason])}: </strong>
                {absence.startsOn === absence.endsOn ? from : `${from} – ${until}`}
                <div className="actions">
                  <button type="button" aria-label={t('removeAbsenceFrom', { day: from })} onClick={() => void change(() => removeAbsence(childId, absence.id))}>
                    {t('removeAbsence')}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <ProblemAlert problem={problem} />
    </section>
  )
}
