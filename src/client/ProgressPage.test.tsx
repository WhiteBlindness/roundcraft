import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProgressPage } from './ProgressPage'

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function validMeta() {
  return { request_id: crypto.randomUUID(), api_version: 'v1' as const }
}

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    edition_id: 'edition_001',
    state: 'debrief_complete',
    total_score: 89,
    display_main: 45,
    display_evidence: 16,
    display_followup: 28,
    issued_at: '2026-09-01T14:45:00Z',
    debrief_completed_at: '2026-09-01T15:00:00Z',
    metadata: { case_number: 1 },
    ...overrides,
  }
}

describe('ProgressPage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows the empty state with a link to Today', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          ok: true,
          data: { entries: [] },
          error: null,
          meta: validMeta(),
        }),
      ),
    )

    const onNavigate = vi.fn()
    render(<ProgressPage onNavigateToday={onNavigate} />)

    expect(
      await screen.findByRole('heading', { name: 'No scored cases yet' }),
    ).toBeInTheDocument()

    const link = screen.getByText('Go to Today')
    expect(link).toBeInTheDocument()
  })

  it('treats a 401 (no session yet) as an empty history, not an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          {
            ok: false,
            data: null,
            error: { code: 'SESSION_INVALID', message: 'No session' },
            meta: validMeta(),
          },
          401,
        ),
      ),
    )

    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(<ProgressPage onNavigateToday={onNavigate} />)

    expect(
      await screen.findByRole('heading', { name: 'No scored cases yet' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('History unavailable')).toBeNull()

    await user.click(screen.getByText('Go to Today'))
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it('shows error state with retry', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: { entries: [] },
          error: null,
          meta: validMeta(),
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    render(<ProgressPage onNavigateToday={vi.fn()} />)

    expect(
      await screen.findByRole('heading', { name: 'History unavailable' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('heading', { name: 'No scored cases yet' }),
    ).toBeInTheDocument()
  })

  it('renders summary stats and table rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          ok: true,
          data: {
            entries: [
              makeEntry({ edition_id: 'edition_001', total_score: 80 }),
              makeEntry({
                edition_id: 'edition_002',
                total_score: 92,
                metadata: { case_number: 2 },
              }),
            ],
          },
          error: null,
          meta: validMeta(),
        }),
      ),
    )

    render(<ProgressPage onNavigateToday={vi.fn()} />)

    expect(
      await screen.findByRole('heading', { name: 'Scored history' }),
    ).toBeInTheDocument()

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('86/100')).toBeInTheDocument()
    expect(screen.getByText('92/100')).toBeInTheDocument()

    expect(screen.getByText('Case 001')).toBeInTheDocument()
    expect(screen.getByText('Case 002')).toBeInTheDocument()
  })

  it('formats dates as DD/MM/YYYY', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          ok: true,
          data: {
            entries: [
              makeEntry({ issued_at: '2026-03-15T10:00:00Z' }),
            ],
          },
          error: null,
          meta: validMeta(),
        }),
      ),
    )

    render(<ProgressPage onNavigateToday={vi.fn()} />)

    expect(await screen.findByText('15/03/2026')).toBeInTheDocument()
  })

  it('falls back to edition_id when case_number is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          ok: true,
          data: {
            entries: [makeEntry({ metadata: {} })],
          },
          error: null,
          meta: validMeta(),
        }),
      ),
    )

    render(<ProgressPage onNavigateToday={vi.fn()} />)

    expect(await screen.findByText('edition_001')).toBeInTheDocument()
  })
})
