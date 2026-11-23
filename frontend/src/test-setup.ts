import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  // The Group chosen in the top bar is kept per tab; each test starts with none.
  sessionStorage.clear()
})
