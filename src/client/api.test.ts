import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  loadToday,
  loadCases,
  loadProgress,
  recordEvent,
  deleteHistory,
} from './api'

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function validMeta() {
  return { request_id: crypto.randomUUID(), api_version: 'v1' as const }
}

describe('api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('loadToday', () => {
    it('parses a valid available response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(
          jsonResponse({
            ok: true,
            data: {
              availability: 'available',
              edition: {
                edition_id: 'edition_001',
                case_number: 1,
                edition_date_utc: '2026-09-01',
                estimated_minutes: 7,
                focus: 'Information',
                status: 'new',
                primary_action: 'start_case',
                origin: 'synthetic',
                origin_label: 'Synthetic scenario.',
              },
            },
            error: null,
            meta: validMeta(),
          }),
        ),
      )

      const data = await loadToday()
      expect(data.availability).toBe('available')
      if (data.availability === 'available') {
        expect(data.edition.edition_id).toBe('edition_001')
      }
    })

    it('parses a valid unavailable response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(
          jsonResponse({
            ok: true,
            data: {
              availability: 'unavailable',
              edition: null,
              status: 'unavailable',
              primary_action: 'retry_later',
            },
            error: null,
            meta: validMeta(),
          }),
        ),
      )

      const data = await loadToday()
      expect(data.availability).toBe('unavailable')
    })

    it('rejects on a non-ok HTTP response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })),
      )

      await expect(loadToday()).rejects.toThrow(
        'The service is temporarily unavailable.',
      )
    })

    it('rejects on a malformed payload', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(
          jsonResponse({ unexpected: true }),
        ),
      )

      await expect(loadToday()).rejects.toThrow(
        'The service returned an invalid response.',
      )
    })
  })

  describe('loadCases', () => {
    const validCasesResponse = {
      ok: true,
      data: {
        editions: [
          {
            edition_id: 'edition_001',
            release_at: '2026-09-01T00:00:00Z',
            metadata: {},
          },
        ],
        next_cursor: null,
      },
      error: null,
      meta: validMeta(),
    }

    it('calls without cursor when none is provided', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse(validCasesResponse))
      vi.stubGlobal('fetch', fetchMock)

      await loadCases()

      expect(fetchMock).toHaveBeenCalledWith('/api/v1/cases', expect.any(Object))
    })

    it('appends cursor as a query parameter', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse(validCasesResponse))
      vi.stubGlobal('fetch', fetchMock)

      await loadCases('abc123')

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/cases?cursor=abc123',
        expect.any(Object),
      )
    })

    it('returns parsed editions', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(validCasesResponse)),
      )

      const data = await loadCases()
      expect(data.editions).toHaveLength(1)
      expect(data.editions[0]?.edition_id).toBe('edition_001')
    })
  })

  describe('loadProgress', () => {
    it('returns parsed entries', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(
          jsonResponse({
            ok: true,
            data: {
              entries: [
                {
                  edition_id: 'edition_001',
                  state: 'debrief_complete',
                  total_score: 89,
                  display_main: 45,
                  display_evidence: 16,
                  display_followup: 28,
                  issued_at: '2026-09-01T14:45:00Z',
                  debrief_completed_at: '2026-09-01T15:00:00Z',
                  metadata: {},
                },
              ],
            },
            error: null,
            meta: validMeta(),
          }),
        ),
      )

      const data = await loadProgress()
      expect(data.entries).toHaveLength(1)
      expect(data.entries[0]?.total_score).toBe(89)
    })
  })

  describe('recordEvent', () => {
    it('silently discards network failures', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockRejectedValue(new Error('Network error')),
      )

      await expect(
        recordEvent('today_loaded', { edition_id: 'edition_001' }, 'a'.repeat(43)),
      ).resolves.toBeUndefined()
    })

    it('silently discards non-ok responses', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 500 })),
      )

      await expect(
        recordEvent('today_loaded', {}, 'a'.repeat(43)),
      ).resolves.toBeUndefined()
    })
  })

  describe('deleteHistory', () => {
    it('sends DELETE with correct headers', async () => {
      const token = 'a'.repeat(43)
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          ok: true,
          data: { deleted: true },
          error: null,
          meta: validMeta(),
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      await deleteHistory(token)

      expect(fetchMock).toHaveBeenCalledWith('/api/v1/history', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': token,
        },
        body: '{}',
      })
    })

    it('rejects when the server returns an error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 })),
      )

      await expect(deleteHistory('a'.repeat(43))).rejects.toThrow(
        'The service is temporarily unavailable.',
      )
    })
  })
})
