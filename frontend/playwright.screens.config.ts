import { defineConfig } from '@playwright/test'
import tests from './playwright.config.ts'

// Screenshots for the usability test (screens/), not a test of the app: `npm run screens`.
export default defineConfig({ ...tests, testDir: './screens' })
