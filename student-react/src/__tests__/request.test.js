import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  makeAbortableTimeout,
  fetchWithTimeout,
  extractErrorMessage,
  isAuthExpired,
} from '../lib/request'

// ── makeAbortableTimeout ────────────────────────────────────────────

describe('makeAbortableTimeout', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns signal, cancel, controller, clear', () => {
    const result = makeAbortableTimeout(5000)
    expect(result).toHaveProperty('signal')
    expect(result).toHaveProperty('cancel')
    expect(result).toHaveProperty('controller')
    expect(result).toHaveProperty('clear')
  })

  it('aborts after the specified ms', () => {
    const { signal } = makeAbortableTimeout(1000)
    expect(signal.aborted).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(signal.aborted).toBe(true)
    expect(signal.__abortReason).toBe('timeout')
  })

  it('does NOT abort when ms is undefined', () => {
    const { signal } = makeAbortableTimeout()
    vi.advanceTimersByTime(60000)
    expect(signal.aborted).toBe(false)
  })

  it('cancel() aborts immediately with reason "cancel"', () => {
    const { signal, cancel } = makeAbortableTimeout(5000)
    cancel()
    expect(signal.aborted).toBe(true)
    expect(signal.__abortReason).toBe('cancel')
  })

  it('clear() prevents the timeout from firing', () => {
    const { signal, clear } = makeAbortableTimeout(1000)
    clear()
    vi.advanceTimersByTime(2000)
    expect(signal.aborted).toBe(false)
  })
})

// ── fetchWithTimeout ────────────────────────────────────────────────

describe('fetchWithTimeout', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('returns the response on success', async () => {
    const fakeResponse = { ok: true, status: 200 }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse))

    const res = await fetchWithTimeout('/api/test', { method: 'GET' })
    expect(res).toBe(fakeResponse)
    expect(fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({ method: 'GET' }))
  })

  it('throws TIMEOUT error when request exceeds timeoutMs', async () => {
    // Use real timers for this test since it involves real async abort behavior
    vi.useRealTimers()

    vi.stubGlobal('fetch', vi.fn((url, opts) =>
      new Promise((resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    ))

    await expect(
      fetchWithTimeout('/api/test', {}, { timeoutMs: 50 })
    ).rejects.toMatchObject({
      message: 'Request timed out',
      code: 'TIMEOUT',
    })

    vi.useFakeTimers()
  })

  it('passes Authorization header through correctly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    await fetchWithTimeout('/api/mark', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token-123' },
    })

    const passedOptions = fetch.mock.calls[0][1]
    expect(passedOptions.headers.Authorization).toBe('Bearer test-token-123')
  })
})

// ── extractErrorMessage ─────────────────────────────────────────────

describe('extractErrorMessage', () => {
  it('extracts text from response body', async () => {
    const res = { status: 400, statusText: 'Bad Request', text: async () => 'Invalid file type' }
    const msg = await extractErrorMessage(res)
    expect(msg).toBe('400 Bad Request: Invalid file type')
  })

  it('truncates long messages to 200 chars', async () => {
    const longText = 'A'.repeat(500)
    const res = { status: 500, statusText: 'Error', text: async () => longText }
    const msg = await extractErrorMessage(res)
    expect(msg.length).toBeLessThanOrEqual(200 + '500 Error: '.length)
  })

  it('falls back to status when text() fails', async () => {
    const res = { status: 502, statusText: 'Bad Gateway', text: async () => { throw new Error() } }
    const msg = await extractErrorMessage(res)
    expect(msg).toBe('502 Bad Gateway')
  })

  it('returns "Unknown error" for null response', async () => {
    expect(await extractErrorMessage(null)).toBe('Unknown error')
  })
})

// ── isAuthExpired ───────────────────────────────────────────────────

describe('isAuthExpired', () => {
  it('returns true for 401', () => expect(isAuthExpired({ status: 401 })).toBe(true))
  it('returns true for 403', () => expect(isAuthExpired({ status: 403 })).toBe(true))
  it('returns false for 200', () => expect(isAuthExpired({ status: 200 })).toBe(false))
  it('returns false for 500', () => expect(isAuthExpired({ status: 500 })).toBe(false))
  it('returns false for null', () => expect(isAuthExpired(null)).toBe(false))
})
