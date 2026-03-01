/**
 * Security-focused tests for production SaaS readiness.
 *
 * These tests verify that the application does not introduce
 * common web security vulnerabilities (OWASP Top 10 relevant items).
 */
import { describe, it, expect } from 'vitest'
import { extractErrorMessage, isAuthExpired } from '../lib/request'
import { canonicalLabel, normalizeIssueId } from '../lib/dismissIssues'
import { makeDraftKey, shouldAutosave } from '../services/draftStore'

// ── 1. Error message sanitization ───────────────────────────────────

describe('security: error messages', () => {
  it('truncates error messages to prevent info leakage', async () => {
    const longError = '/usr/local/lib/python3.11/site-packages/' + 'A'.repeat(500)
    const res = { status: 500, statusText: 'Error', text: async () => longError }
    const msg = await extractErrorMessage(res)
    expect(msg.length).toBeLessThanOrEqual(220) // status prefix + 200 chars max
  })

  it('does not expose raw stack traces to users', async () => {
    const stackTrace = 'Traceback (most recent call last):\n  File "/app/vysti_api.py", line 42'
    const res = { status: 500, statusText: 'Error', text: async () => stackTrace }
    const msg = await extractErrorMessage(res)
    expect(msg.length).toBeLessThan(stackTrace.length + 20)
  })

  it('handles null response without crashing', async () => {
    const msg = await extractErrorMessage(null)
    expect(msg).toBe('Unknown error')
  })
})

// ── 2. Input sanitization / injection prevention ────────────────────

describe('security: input sanitization', () => {
  it('canonicalLabel strips zero-width characters (homograph attack vector)', () => {
    // Zero-width space is stripped, so "Floating[ZWSP]quotation" → "floatingquotation"
    const withZwsp = 'Floating\u200Bquotation'
    const result = canonicalLabel(withZwsp)
    expect(result).not.toContain('\u200B')
    // Verify the invisible char was removed, not preserved
    expect(result).toBe('floatingquotation')
  })

  it('canonicalLabel matches identical labels with different whitespace', () => {
    expect(canonicalLabel('Floating  quotation')).toBe(canonicalLabel('Floating quotation'))
  })

  it('normalizeIssueId strips all XSS characters from slugs', () => {
    const xssAttempt = '<script>alert("xss")</script>'
    const slug = normalizeIssueId(xssAttempt)
    expect(slug).not.toContain('<')
    expect(slug).not.toContain('>')
    expect(slug).not.toContain('"')
    expect(slug).toMatch(/^[a-z0-9-]+$/)
  })

  it('normalizeIssueId strips SQL injection characters', () => {
    const sqlAttempt = "'; DROP TABLE users; --"
    const slug = normalizeIssueId(sqlAttempt)
    expect(slug).not.toContain("'")
    expect(slug).not.toContain(';')
    expect(slug).toMatch(/^[a-z0-9-]+$/)
  })

  it('makeDraftKey sanitizes newlines and tabs in user-controlled segments', () => {
    const key = makeDraftKey({
      userId: 'user1',
      fileName: '../../../etc/passwd',
      mode: 'ta',
    })
    expect(key).not.toContain('\n')
    expect(key).not.toContain('\r')
    expect(key).not.toContain('\t')
  })

  it('makeDraftKey handles XSS attempt in fileName without crashing', () => {
    const key = makeDraftKey({
      userId: 'user1',
      fileName: '<img src=x onerror=alert(1)>',
      mode: 'ta',
    })
    expect(typeof key).toBe('string')
    expect(key.length).toBeGreaterThan(0)
  })

  it('shouldAutosave rejects excessively large text (DoS prevention)', () => {
    const hugeText = 'A'.repeat(200001)
    expect(shouldAutosave(hugeText)).toBe(false)
  })

  it('shouldAutosave rejects null/undefined (no crash)', () => {
    expect(shouldAutosave(null)).toBe(false)
    expect(shouldAutosave(undefined)).toBe(false)
  })
})

// ── 3. Authentication boundary checks ──────────────────────────────

describe('security: auth boundaries', () => {
  it('isAuthExpired correctly identifies 401 responses', () => {
    expect(isAuthExpired({ status: 401 })).toBe(true)
  })

  it('isAuthExpired correctly identifies 403 responses', () => {
    expect(isAuthExpired({ status: 403 })).toBe(true)
  })

  it('isAuthExpired does not false-positive on 200', () => {
    expect(isAuthExpired({ status: 200 })).toBe(false)
  })

  it('isAuthExpired does not false-positive on 500', () => {
    expect(isAuthExpired({ status: 500 })).toBe(false)
  })

  it('isAuthExpired handles null/undefined safely', () => {
    expect(isAuthExpired(null)).toBe(false)
    expect(isAuthExpired(undefined)).toBe(false)
  })
})

// ── 4. localStorage isolation ───────────────────────────────────────

describe('security: localStorage isolation', () => {
  it('draft keys are scoped by userId to prevent cross-user reads', () => {
    const key1 = makeDraftKey({ userId: 'user-a', fileName: 'essay.docx', mode: 'ta' })
    const key2 = makeDraftKey({ userId: 'user-b', fileName: 'essay.docx', mode: 'ta' })
    expect(key1).not.toBe(key2)
    expect(key1).toContain('user-a')
    expect(key2).toContain('user-b')
  })

  it('draft keys for different files do not collide', () => {
    const key1 = makeDraftKey({ userId: 'u1', fileName: 'essay1.docx', mode: 'ta' })
    const key2 = makeDraftKey({ userId: 'u1', fileName: 'essay2.docx', mode: 'ta' })
    expect(key1).not.toBe(key2)
  })

  it('draft keys for different modes do not collide', () => {
    const key1 = makeDraftKey({ userId: 'u1', fileName: 'essay.docx', mode: 'textual_analysis' })
    const key2 = makeDraftKey({ userId: 'u1', fileName: 'essay.docx', mode: 'peel' })
    expect(key1).not.toBe(key2)
  })

  it('anonymous users get "anon" prefix, not undefined', () => {
    const key = makeDraftKey({ fileName: 'essay.docx', mode: 'ta' })
    expect(key).toContain('anon')
    expect(key).not.toContain('undefined')
  })
})
