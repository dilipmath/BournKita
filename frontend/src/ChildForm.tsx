import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { genderLabel, saveChild, type Child, type ChildDetails, type Gender, type Refusal } from './api'

type Problem = Refusal | 'somethingWentWrong' | null

const empty: ChildDetails = { firstName: '', lastName: '', gender: null, languages: '', foodPreferences: '', interests: '' }

/** Creates a Child profile, or edits `child`. Admins only; shows the profile once saved. */
export default function ChildForm({ child }: { child?: Child }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [details, setDetails] = useState<ChildDetails>(() => {
    if (!child) return empty
    const { id: _, ...current } = child
    return current
  })
  const [problem, setProblem] = useState<Problem>(null)
  const [submitting, setSubmitting] = useState(false)

  function field(name: Exclude<keyof ChildDetails, 'gender'>) {
    return {
      value: details[name],
      onChange: (event: { target: { value: string } }) => setDetails({ ...details, [name]: event.target.value }),
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setProblem(null)
    try {
      const result = await saveChild(details, child?.id)
      if (typeof result === 'string') setProblem(result)
      else navigate(`/children/${result.id}`)
    } catch {
      setProblem('somethingWentWrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="page child-form" onSubmit={(event) => void submit(event)}>
      <h2>{t(child ? 'editChildProfile' : 'newChildProfile')}</h2>
      <label>
        {t('firstName')}
        <input required maxLength={100} {...field('firstName')} />
      </label>
      <label>
        {t('lastName')}
        <input required maxLength={100} {...field('lastName')} />
      </label>
      <label>
        {t('gender')}
        <select
          value={details.gender ?? ''}
          onChange={(event) => setDetails({ ...details, gender: (event.target.value || null) as Gender | null })}
        >
          <option value="">{t('genderNotStated')}</option>
          {(Object.keys(genderLabel) as Gender[]).map((gender) => (
            <option key={gender} value={gender}>
              {t(genderLabel[gender])}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('languagesSpoken')}
        <input maxLength={200} {...field('languages')} />
      </label>
      <label>
        {t('foodPreferences')}
        <textarea maxLength={2000} {...field('foodPreferences')} />
      </label>
      <label>
        {t('interests')}
        <textarea maxLength={2000} {...field('interests')} />
      </label>
      {problem && (
        <p className="status status-problem" role="alert">
          {t(problem)}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="primary" disabled={submitting}>
          {t('save')}
        </button>
        <Link className="button" to={child ? `/children/${child.id}` : '/children'}>
          {t('cancel')}
        </Link>
      </div>
    </form>
  )
}
