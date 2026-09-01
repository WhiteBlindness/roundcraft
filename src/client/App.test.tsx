import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'

describe('App', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('loads the public Today cover and creates a session on start', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
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
              origin_label:
                'Synthetic scenario — editorial tactical analysis.',
            },
          },
          error: null,
          meta: { request_id: crypto.randomUUID(), api_version: 'v1' },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          data: {
            csrf_token: 'a'.repeat(43),
            identity_expires_at: '2026-11-30T12:00:00.000Z',
          },
          error: null,
          meta: { request_id: crypto.randomUUID(), api_version: 'v1' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(await screen.findByText('Case 001')).toBeInTheDocument()
    expect(
      screen.getByText('Synthetic scenario — editorial tactical analysis.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start case' })).toBeEnabled()
    expect(screen.queryByText('Decisive evidence')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start case' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      'Session secured. Attempt creation is the next step.',
    )
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/today', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
  })

  it('shows a neutral unavailable state without inventing a case', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          ok: true,
          data: {
            availability: 'unavailable',
            edition: null,
            status: 'unavailable',
            primary_action: 'retry_later',
          },
          error: null,
          meta: { request_id: crypto.randomUUID(), api_version: 'v1' },
        }),
      ),
    )

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'No current case' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start case' })).toBeNull()

    await waitFor(() =>
      expect(screen.getByText('Retry later')).toBeInTheDocument(),
    )
  })

  it('recovers from an invalid Today response when retried', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ unexpected: true }))
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          data: {
            availability: 'unavailable',
            edition: null,
            status: 'unavailable',
            primary_action: 'retry_later',
          },
          error: null,
          meta: { request_id: crypto.randomUUID(), api_version: 'v1' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(
      await screen.findByRole('heading', {
        name: 'Case service unavailable',
      }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('heading', { name: 'No current case' }),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows a safe message when session creation fails', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
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
          meta: { request_id: crypto.randomUUID(), api_version: 'v1' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    await user.click(
      await screen.findByRole('button', { name: 'Start case' }),
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The session could not be secured. Please try again.',
    )
  })
})
