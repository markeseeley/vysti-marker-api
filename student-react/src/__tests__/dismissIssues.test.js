import { describe, it, expect } from 'vitest'
import {
  canonicalLabel,
  normalizeIssueId,
  dismissNoAskKey,
  loadDismissNoAsk,
  saveDismissNoAsk,
  currentDismissStorageKey,
  loadDismissedIssuesFromStorage,
  saveDismissedIssuesToStorage,
  isDismissedIssueInstance,
  filterDismissedExamples,
  applyDismissalsToLabelCounts,
} from '../lib/dismissIssues'

// ── canonicalLabel ──────────────────────────────────────────────────

describe('canonicalLabel', () => {
  it('lowercases and trims', () => {
    expect(canonicalLabel('  Floating Quotation  ')).toBe('floating quotation')
  })

  it('normalizes smart quotes to plain quotes', () => {
    expect(canonicalLabel('Avoid \u201Cthis\u201D')).toBe('avoid "this"')
  })

  it('normalizes em-dashes to hyphens', () => {
    expect(canonicalLabel('word\u2014test')).toBe('word-test')
  })

  it('returns empty string for null/undefined', () => {
    expect(canonicalLabel(null)).toBe('')
    expect(canonicalLabel(undefined)).toBe('')
  })
})

// ── normalizeIssueId ────────────────────────────────────────────────

describe('normalizeIssueId', () => {
  it('produces a slug from a label', () => {
    expect(normalizeIssueId('Floating quotation')).toBe('floating-quotation')
  })

  it('strips leading/trailing hyphens', () => {
    expect(normalizeIssueId('  --test-- ')).toBe('test')
  })

  it('returns "issue" for empty input', () => {
    expect(normalizeIssueId('')).toBe('issue')
  })
})

// ── dismissNoAsk (localStorage persistence) ─────────────────────────

describe('dismissNoAsk', () => {
  it('round-trips a dismiss-no-ask record', () => {
    saveDismissNoAsk('Floating quotation', 'not_relevant', 'test reason')
    const loaded = loadDismissNoAsk('Floating quotation')
    expect(loaded).toEqual({ reason: 'not_relevant', other_text: 'test reason' })
  })

  it('returns null when nothing stored', () => {
    expect(loadDismissNoAsk('Unknown label')).toBeNull()
  })
})

// ── dismissed issues storage ────────────────────────────────────────

describe('dismissed issues storage', () => {
  it('round-trips dismissed issues array', () => {
    const issues = [
      { label: 'Floating quotation', sentence: 'Test sentence.', file_name: 'essay.docx', reason: 'ok' },
    ]
    saveDismissedIssuesToStorage({ markEventId: '123', fileName: 'essay.docx', dismissedIssues: issues })
    const loaded = loadDismissedIssuesFromStorage({ markEventId: '123', fileName: 'essay.docx' })
    expect(loaded).toEqual(issues)
  })

  it('returns empty array when nothing stored', () => {
    expect(loadDismissedIssuesFromStorage({ markEventId: 'nope', fileName: 'x' })).toEqual([])
  })

  it('currentDismissStorageKey uses markEventId when available', () => {
    const key = currentDismissStorageKey({ markEventId: 'abc', fileName: 'file.docx' })
    expect(key).toContain('mark_abc')
  })

  it('currentDismissStorageKey falls back to fileName', () => {
    const key = currentDismissStorageKey({ markEventId: null, fileName: 'file.docx' })
    expect(key).toContain('file_file.docx')
  })
})

// ── isDismissedIssueInstance ────────────────────────────────────────

describe('isDismissedIssueInstance', () => {
  const dismissed = [
    { file_name: 'essay.docx', label: 'Floating quotation', sentence: 'The quote floats.' },
  ]

  it('returns true for an exact match', () => {
    expect(isDismissedIssueInstance(dismissed, 'essay.docx', 'Floating quotation', 'The quote floats.')).toBe(true)
  })

  it('matches despite smart quotes vs plain quotes', () => {
    expect(isDismissedIssueInstance(dismissed, 'essay.docx', 'Floating quotation', 'The quote floats.')).toBe(true)
  })

  it('returns false for different file', () => {
    expect(isDismissedIssueInstance(dismissed, 'other.docx', 'Floating quotation', 'The quote floats.')).toBe(false)
  })

  it('returns false for different label', () => {
    expect(isDismissedIssueInstance(dismissed, 'essay.docx', 'Off-topic', 'The quote floats.')).toBe(false)
  })

  it('returns false for different sentence', () => {
    expect(isDismissedIssueInstance(dismissed, 'essay.docx', 'Floating quotation', 'Something else.')).toBe(false)
  })

  it('returns false when inputs are null/empty', () => {
    expect(isDismissedIssueInstance(dismissed, '', '', '')).toBe(false)
    expect(isDismissedIssueInstance(null, 'essay.docx', 'test', 'test')).toBe(false)
  })
})

// ── filterDismissedExamples ─────────────────────────────────────────

describe('filterDismissedExamples', () => {
  const dismissed = [
    { file_name: 'essay.docx', label: 'Floating quotation', sentence: 'Bad quote here.' },
  ]

  it('removes dismissed examples from the list', () => {
    const examples = [
      { label: 'Floating quotation', sentence: 'Bad quote here.' },
      { label: 'Floating quotation', sentence: 'Good quote here.' },
    ]
    const filtered = filterDismissedExamples(examples, dismissed, 'essay.docx', 'Floating quotation')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].sentence).toBe('Good quote here.')
  })
})

// ── applyDismissalsToLabelCounts ────────────────────────────────────

describe('applyDismissalsToLabelCounts', () => {
  it('subtracts dismissed counts from label counts', () => {
    const counts = { 'Floating quotation': 3, 'Off-topic': 1 }
    const dismissed = [
      { file_name: 'essay.docx', label: 'Floating quotation' },
      { file_name: 'essay.docx', label: 'Floating quotation' },
    ]
    const result = applyDismissalsToLabelCounts(counts, dismissed, 'essay.docx')
    expect(result['Floating quotation']).toBe(1)
    expect(result['Off-topic']).toBe(1)
  })

  it('deletes label when count reaches 0', () => {
    const counts = { 'Off-topic': 1 }
    const dismissed = [{ file_name: 'essay.docx', label: 'Off-topic' }]
    const result = applyDismissalsToLabelCounts(counts, dismissed, 'essay.docx')
    expect(result).not.toHaveProperty('Off-topic')
  })

  it('ignores dismissals from a different file', () => {
    const counts = { 'Off-topic': 2 }
    const dismissed = [{ file_name: 'other.docx', label: 'Off-topic' }]
    const result = applyDismissalsToLabelCounts(counts, dismissed, 'essay.docx')
    expect(result['Off-topic']).toBe(2)
  })

  it('never goes below 0', () => {
    const counts = { 'Off-topic': 1 }
    const dismissed = [
      { file_name: 'essay.docx', label: 'Off-topic' },
      { file_name: 'essay.docx', label: 'Off-topic' },
      { file_name: 'essay.docx', label: 'Off-topic' },
    ]
    const result = applyDismissalsToLabelCounts(counts, dismissed, 'essay.docx')
    expect(result).not.toHaveProperty('Off-topic')
  })
})
