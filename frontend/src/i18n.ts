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
      logIn: 'Log in',
      logOut: 'Log out',
      emailAddress: 'Email address',
      password: 'Password',
      loggedInAs: 'Logged in as {{email}}',
      invalidCredentials: 'Email address or password is wrong.',
      loginUnavailable: 'Logging in is not possible right now. Please try again.',
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
      logIn: 'Anmelden',
      logOut: 'Abmelden',
      emailAddress: 'E-Mail-Adresse',
      password: 'Passwort',
      loggedInAs: 'Angemeldet als {{email}}',
      invalidCredentials: 'E-Mail-Adresse oder Passwort ist falsch.',
      loginUnavailable: 'Anmelden ist gerade nicht möglich. Bitte erneut versuchen.',
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
