import '@testing-library/jest-dom';
import { afterAll, beforeAll, vi } from 'vitest'

const noisyPatterns = [
  'React Router Future Flag Warning',
  'Unable to load categories',
  'Unable to load dashboard overview',
  'Unable to load hero content',
  'Unable to load services',
  'Unable to load seller split',
  'Unable to load listings collections',
  'Unable to load testimonials',
  'Unable to load trending searches',
  'Unable to load storefronts',
  'Unable to refresh conversations snapshot',
  'Unable to load conversations',
  'fallback.map is not a function',
  'not wrapped in act(...)',
  'Mapbox token loaded',
  '[ListingDetail] Mapbox token present',
]

const shouldSilence = (args: unknown[]) => {
  const text = args
    .map(arg => (typeof arg === 'string' ? arg : arg instanceof Error ? arg.message : String(arg)))
    .join(' ')
  return noisyPatterns.some(pattern => text.includes(pattern))
}

const originalWarn = console.warn.bind(console)
const originalError = console.error.bind(console)
const originalLog = console.log.bind(console)
const originalInfo = console.info.bind(console)

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (shouldSilence(args)) {
      return
    }
    originalWarn(...args)
  })

  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (shouldSilence(args)) {
      return
    }
    originalError(...args)
  })

  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    if (shouldSilence(args)) {
      return
    }
    originalLog(...args)
  })

  vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => {
    if (shouldSilence(args)) {
      return
    }
    originalInfo(...args)
  })
})

afterAll(() => {
  vi.restoreAllMocks()
})
