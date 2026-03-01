import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Clean up rendered components after each test
afterEach(() => {
  cleanup()
})

// Stub localStorage for all tests
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((i) => Object.keys(store)[i] ?? null),
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

// Reset localStorage between tests
afterEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
})

// Suppress console.error noise from React in tests
const originalConsoleError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('act(')) return
    originalConsoleError(...args)
  }
})
afterAll(() => {
  console.error = originalConsoleError
})
