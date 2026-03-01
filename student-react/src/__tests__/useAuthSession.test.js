import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Mock the dependencies BEFORE importing the hook
vi.mock('../lib/auth', () => ({
  redirectToSignin: vi.fn(),
}))
vi.mock('../lib/logger', () => ({
  logEvent: vi.fn(),
  logError: vi.fn(),
}))
vi.mock('../lib/supa', () => ({
  getSupaClient: vi.fn(),
}))

import { useAuthSession } from '../hooks/useAuthSession'
import { redirectToSignin } from '../lib/auth'
import { getSupaClient } from '../lib/supa'

const mockSupaClient = (hasSession = true) => ({
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: hasSession ? { access_token: 'tok', user: { id: 'u1' } } : null,
      },
    }),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  },
})

describe('useAuthSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets isChecking=false and supa when session is valid', async () => {
    const client = mockSupaClient(true)
    getSupaClient.mockReturnValue(client)

    const { result } = renderHook(() => useAuthSession())

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false)
    })

    expect(result.current.supa).toBe(client)
    expect(result.current.authError).toBe('')
  })

  it('redirects to signin when session is missing', async () => {
    const client = mockSupaClient(false)
    getSupaClient.mockReturnValue(client)

    renderHook(() => useAuthSession())

    await waitFor(() => {
      expect(redirectToSignin).toHaveBeenCalled()
    })
  })

  it('sets authError when Supabase client is unavailable', async () => {
    getSupaClient.mockReturnValue(null)

    const { result } = renderHook(() => useAuthSession())

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false)
    })

    expect(result.current.authError).toContain('Supabase client not available')
  })

  it('stores role in localStorage when session is valid', async () => {
    getSupaClient.mockReturnValue(mockSupaClient(true))

    renderHook(() => useAuthSession('teacher'))

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('vysti_role', 'teacher')
    })
  })

  it('subscribes to auth state changes', async () => {
    const client = mockSupaClient(true)
    getSupaClient.mockReturnValue(client)

    renderHook(() => useAuthSession())

    await waitFor(() => {
      expect(client.auth.onAuthStateChange).toHaveBeenCalled()
    })
  })

  it('unsubscribes on unmount', async () => {
    const unsub = vi.fn()
    const client = mockSupaClient(true)
    client.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: unsub } },
    })
    getSupaClient.mockReturnValue(client)

    const { unmount } = renderHook(() => useAuthSession())
    await waitFor(() => {})
    unmount()

    expect(unsub).toHaveBeenCalled()
  })

  it('sets authError when getSession throws', async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockRejectedValue(new Error('Network error')),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    }
    getSupaClient.mockReturnValue(client)

    const { result } = renderHook(() => useAuthSession())

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false)
    })

    expect(result.current.authError).toContain('Unable to verify session')
  })
})
