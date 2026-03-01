import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  makeDraftKey,
  loadDraft,
  saveDraft,
  deleteDraft,
  shouldAutosave,
  throttle,
} from '../services/draftStore'

describe('makeDraftKey', () => {
  it('builds a key from userId, fileName, mode', () => {
    const key = makeDraftKey({ userId: 'u1', fileName: 'essay.docx', mode: 'textual_analysis' })
    expect(key).toBe('vysti:draft:u1:essay.docx:textual_analysis')
  })

  it('defaults userId to "anon" when missing', () => {
    const key = makeDraftKey({ fileName: 'test.docx', mode: 'peel' })
    expect(key).toContain('anon')
  })

  it('sanitizes newlines, tabs, and whitespace in user segments', () => {
    const key = makeDraftKey({ userId: 'u1', fileName: 'my\nfile', mode: 'test mode' })
    // The key format is vysti:draft:userId:fileName:mode — colons are structural
    // User-supplied segments (after the vysti:draft: prefix) should have no newlines/tabs
    const userSegments = key.replace('vysti:draft:', '')
    expect(userSegments).not.toMatch(/[\n\r\t]/)
  })

  it('truncates very long segments to prevent localStorage key bloat', () => {
    const longName = 'A'.repeat(500)
    const key = makeDraftKey({ userId: 'u1', fileName: longName, mode: 'ta' })
    // safeSegment caps at 120 chars
    expect(key.length).toBeLessThan(300)
  })
})

describe('saveDraft / loadDraft / deleteDraft', () => {
  it('round-trips a draft through localStorage', () => {
    const params = { userId: 'u1', fileName: 'essay.docx', mode: 'ta' }
    saveDraft({ ...params, text: 'Hello world' })

    const draft = loadDraft(params)
    expect(draft).not.toBeNull()
    expect(draft.text).toBe('Hello world')
    expect(draft.savedAt).toBeTruthy()
    expect(draft.version).toBe(1)
  })

  it('returns null when no draft exists', () => {
    expect(loadDraft({ userId: 'nobody', fileName: 'x', mode: 'y' })).toBeNull()
  })

  it('deleteDraft removes the stored draft', () => {
    const params = { userId: 'u1', fileName: 'del.docx', mode: 'ta' }
    saveDraft({ ...params, text: 'temp' })
    expect(loadDraft(params)).not.toBeNull()

    deleteDraft(params)
    expect(loadDraft(params)).toBeNull()
  })

  it('loadDraft returns null for corrupt JSON', () => {
    const key = makeDraftKey({ userId: 'u1', fileName: 'bad', mode: 'ta' })
    localStorage.setItem(key, '{not valid json')
    expect(loadDraft({ userId: 'u1', fileName: 'bad', mode: 'ta' })).toBeNull()
  })

  it('loadDraft returns null when stored object is missing text', () => {
    const key = makeDraftKey({ userId: 'u1', fileName: 'empty', mode: 'ta' })
    localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString() }))
    expect(loadDraft({ userId: 'u1', fileName: 'empty', mode: 'ta' })).toBeNull()
  })
})

describe('shouldAutosave', () => {
  it('returns false for empty text', () => {
    expect(shouldAutosave('')).toBe(false)
    expect(shouldAutosave(null)).toBe(false)
    expect(shouldAutosave(undefined)).toBe(false)
  })

  it('returns false for text shorter than 40 chars', () => {
    expect(shouldAutosave('Short text')).toBe(false)
  })

  it('returns true for text between 40 and 200000 chars', () => {
    expect(shouldAutosave('A'.repeat(100))).toBe(true)
  })

  it('returns false for text exceeding 200000 chars', () => {
    expect(shouldAutosave('A'.repeat(200001))).toBe(false)
  })

  it('trims whitespace before checking length', () => {
    expect(shouldAutosave('   ' + 'A'.repeat(35) + '   ')).toBe(false)
    expect(shouldAutosave('   ' + 'A'.repeat(45) + '   ')).toBe(true)
  })
})

describe('throttle', () => {
  beforeEach(() => { vi.useFakeTimers() })

  it('calls the function immediately on first invocation', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 1000)
    throttled('a')
    expect(fn).toHaveBeenCalledWith('a')
  })

  it('skips rapid repeat calls within the window', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 1000)
    throttled('a')
    throttled('b')
    throttled('c')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('fires the last pending call after the throttle window', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 1000)
    throttled('a')
    throttled('b') // queued
    vi.advanceTimersByTime(1000)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  afterEach(() => { vi.useRealTimers() })
})
