import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installCrashReporting } from './crash'
import './i18n'
import './index.css'
import App from './App.tsx'

installCrashReporting(__APP_VERSION__)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
