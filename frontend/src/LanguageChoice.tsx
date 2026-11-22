import { useTranslation } from 'react-i18next'

const languages = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
] as const

/** German or English, each named in its own language. */
export default function LanguageChoice() {
  const { t, i18n } = useTranslation()
  return (
    <nav aria-label={t('language')} className="languages">
      {languages.map(({ code, label }) => (
        <button key={code} type="button" lang={code} aria-pressed={i18n.language === code} onClick={() => void i18n.changeLanguage(code)}>
          {label}
        </button>
      ))}
    </nav>
  )
}
