import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CasesPage } from './CasesPage'

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function validMeta() {
  return { request_id: crypto.randomUUID(), api_version: 'v1' as const }
}

function makeCasesResponse(
  editions: Record<string, unknown>[] = [],
  nextCursor: string | null = null,
) {
  return {
    ok: true,
    data: { editions, next_cursor: nextCursor },
    error: null,
    meta: validMeta(),
  }
}

function makeEdition(
  id: string,
  caseNumber: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    edition_id: id,
    release_at: '2026-09-01T00:00:00Z',
    metadata: {
      case_number: caseNumber,
      edition_date_utc: '2026-09-01',
      estimated_minutes: 7,
      focus: 'Resource allocation',
      origin_label: 'Synthetic scenario.',
      ...overrides,
    },
  }
}

describe('CasesPage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows the empty state when no editions exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(makeCasesResponse()),
      ),
    )

    render(<CasesPage />)

    expect(
      await screen.findByRole('heading', { name: 'No released editions' }),
    ).toBeInTheDocument()
  })

  it('shows error state and retries on failure', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(
        jsonResponse(makeCasesResponse()),
      )
    vi.stubGlobal('fetch', fetchMock)

    render(<CasesPage />)

    expect(
      await screen.findByRole('heading', { name: 'Archive unavailable' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('heading', { name: 'No released editions' }),
    ).toBeInTheDocument()
  })

  it('renders edition cards with metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          makeCasesResponse([
            makeEdition('edition_001', 1),
            makeEdition('edition_002', 2, { focus: 'Information trade' }),
          ]),
        ),
      ),
    )

    render(<CasesPage />)

    expect(await screen.findByText('Case 001')).toBeInTheDocument()
    expect(screen.getByText('Case 002')).toBeInTheDocument()
    expect(screen.getByText('Resource allocation')).toBeInTheDocument()
    expect(screen.getByText('Information trade')).toBeInTheDocument()
    expect(screen.getAllByText('7 min')).toHaveLength(2)
  })

  it('loads more editions when paginated', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          makeCasesResponse([makeEdition('edition_001', 1)], 'cursor_abc'),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          makeCasesResponse([makeEdition('edition_002', 2)]),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    render(<CasesPage />)

    expect(await screen.findByText('Case 001')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Load more' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(() =>
      expect(screen.getByText('Case 002')).toBeInTheDocument(),
    )
    expect(screen.getByText('Case 001')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Load more' }),
    ).toBeNull()
  })

  it('formats edition dates as DD/MM/YYYY', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          makeCasesResponse([
            makeEdition('edition_001', 1, { edition_date_utc: '2026-03-15' }),
          ]),
        ),
      ),
    )

    render(<CasesPage />)

    expect(await screen.findByText('15/03/2026')).toBeInTheDocument()
  })
})
