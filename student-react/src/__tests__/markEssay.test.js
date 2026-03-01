import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies — these are hoisted before imports
vi.mock('@shared/runtimeConfig', () => ({
  getApiBaseUrl: vi.fn(() => 'http://localhost:8000'),
}))

vi.mock('@shared/markingApi', () => ({
  buildMarkFormData: vi.fn(() => new FormData()),
}))

vi.mock('../lib/logger', () => ({
  logEvent: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('../lib/request', () => ({
  fetchWithTimeout: vi.fn(),
  extractErrorMessage: vi.fn(async (res) => `${res.status} Error`),
  isAuthExpired: vi.fn((res) => res?.status === 401 || res?.status === 403),
}))

import { markEssay, markText } from '../services/markEssay'
import { fetchWithTimeout, isAuthExpired } from '../lib/request'

const mockSupa = (hasSession = true) => ({
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: hasSession ? { access_token: 'test-token-abc' } : null,
      },
      error: null,
    }),
  },
})

describe('markEssay', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws when supa is null', async () => {
    await expect(
      markEssay({ supa: null, file: new File(['test'], 'test.docx'), mode: 'ta' })
    ).rejects.toThrow('Supabase is not available')
  })

  it('throws when session is expired', async () => {
    const supa = mockSupa(false)
    const onExpired = vi.fn()

    await expect(
      markEssay({ supa, file: new File(['test'], 'test.docx'), mode: 'ta', onSessionExpired: onExpired })
    ).rejects.toThrow('Session expired')

    expect(onExpired).toHaveBeenCalled()
  })

  it('calls fetchWithTimeout with correct Authorization header', async () => {
    fetchWithTimeout.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/octet-stream' }),
      blob: async () => new Blob(['docx-data'], { type: 'application/octet-stream' }),
    })

    const supa = mockSupa(true)
    await markEssay({ supa, file: new File(['test'], 'test.docx'), mode: 'ta' })

    const callArgs = fetchWithTimeout.mock.calls[0]
    expect(callArgs[0]).toBe('http://localhost:8000/mark')
    expect(callArgs[1].headers.Authorization).toBe('Bearer test-token-abc')
  })

  it('handles JSON response with base64-encoded document', async () => {
    const fakeDocx = btoa('fake-docx-bytes')

    fetchWithTimeout.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/json',
        'X-Vysti-Techniques': 'metaphor,simile',
      }),
      json: async () => ({ document: fakeDocx, metadata: { score: 85 } }),
    })

    const result = await markEssay({ supa: mockSupa(), file: new File(['test'], 'test.docx'), mode: 'ta' })

    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.metadata).toEqual({ score: 85 })
    expect(result.techniquesHeader).toBe('metaphor,simile')
    expect(result.status).toBe(200)
  })

  it('throws SESSION_EXPIRED error on 401 response', async () => {
    fetchWithTimeout.mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
    })

    const onExpired = vi.fn()
    await expect(
      markEssay({ supa: mockSupa(), file: new File(['t'], 'test.docx'), mode: 'ta', onSessionExpired: onExpired })
    ).rejects.toThrow('Session expired')

    expect(onExpired).toHaveBeenCalled()
  })
})

describe('markText', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws when supa is null', async () => {
    await expect(
      markText({ supa: null, payload: { text: 'test' } })
    ).rejects.toThrow('Supabase is not available')
  })

  it('adds return_metadata: true to the payload', async () => {
    fetchWithTimeout.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/octet-stream' }),
      blob: async () => new Blob(['data']),
    })

    await markText({
      supa: mockSupa(),
      payload: { text: 'test text', mode: 'ta' },
    })

    const bodyString = fetchWithTimeout.mock.calls[0][1].body
    const parsed = JSON.parse(bodyString)
    expect(parsed.return_metadata).toBe(true)
    expect(parsed.text).toBe('test text')
  })

  it('sends Content-Type: application/json', async () => {
    fetchWithTimeout.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/octet-stream' }),
      blob: async () => new Blob(['data']),
    })

    await markText({ supa: mockSupa(), payload: { text: 'test' } })

    const headers = fetchWithTimeout.mock.calls[0][1].headers
    expect(headers['Content-Type']).toBe('application/json')
  })
})
