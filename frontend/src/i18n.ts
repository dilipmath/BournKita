import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export const resources = {
  en: {
    translation: {
      appName: 'Kita Kids Database',
      systemStatus: 'System status',
      checking: 'Checking…',
      allWorking: 'All systems working',
      databaseUnavailable: 'Database not reachable',
      notReachable: 'System not reachable',
      language: 'Language',
    },
  },
  de: {
    translation: {
      appName: 'Kita Kids Database',
      systemStatus: 'Systemstatus',
      checking: 'Wird geprüft…',
      allWorking: 'Alles funktioniert',
      databaseUnavailable: 'Datenbank nicht erreichbar',
      notReachable: 'System nicht erreichbar',
      language: 'Sprache',
    },
  },
} as const

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})
