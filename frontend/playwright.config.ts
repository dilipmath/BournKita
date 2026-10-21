import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    browserName: 'chromium',
    // Tablet in landscape: the main device staff use.
    viewport: { width: 1080, height: 810 },
    hasTouch: true,
  },
})
