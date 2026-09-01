import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'

describe('App', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('starts an official attempt and opens only its protected briefing', async () => {
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
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          data: {
            attempt: {
              attempt_id: 'b'.repeat(43),
              edition_id: 'edition_001',
              mode: 'official',
              state: 'issued',
              sequence: 0,
              assisted: false,
              issued_at: '2026-09-01T14:45:00.000Z',
              grace_end_at: '2026-09-02T12:00:00.000Z',
            },
            brief: {
              schemaVersion: 1,
              editionId: 'edition_001',
              caseRevision: 'case_revision_001',
              title: 'The last smoke',
              focus: 'Resource allocation under uncertainty',
              origin: 'synthetic',
              facts: [
                {
                  id: 'bomb',
                  status: 'confirmed',
                  text: 'The bomb is down outside B.',
                },
                {
                  id: 'anchor',
                  status: 'last_seen',
                  text: 'One defender was last seen at A.',
                },
              ],
              actions: [
                { id: 'a', label: 'Regroup toward A', qualifierIds: ['q1', 'q2'] },
                { id: 'b', label: 'Pressure middle', qualifierIds: ['q3', 'q4'] },
                { id: 'c', label: 'Hold shape', qualifierIds: ['q5', 'q6'] },
              ],
              qualifiers: [
                { id: 'q1', label: 'Quietly' },
                { id: 'q2', label: 'Immediately' },
                { id: 'q3', label: 'As a pair' },
                { id: 'q4', label: 'After a delay' },
                { id: 'q5', label: 'Passively' },
                { id: 'q6', label: 'On contact' },
              ],
              evidence: [
                { id: 'e1', label: 'Bomb location' },
                { id: 'e2', label: 'Last defender sighting' },
                { id: 'e3', label: 'Remaining utility' },
                { id: 'e4', label: 'Round clock' },
                { id: 'e5', label: 'Trade spacing' },
              ],
            },
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

    expect(
      await screen.findByRole('heading', { name: 'Read the round' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'The last smoke' }),
    ).toBeInTheDocument()
    expect(screen.getByText('The bomb is down outside B.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose evidence' })).toBeEnabled()
    expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).toBeNull()
    expect(document.body.textContent).not.toContain('SERVER_ONLY')

    await user.click(screen.getByRole('button', { name: 'Choose evidence' }))

    expect(
      screen.getByRole('heading', { name: 'Choose two signals' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(5)
    await user.click(screen.getByRole('checkbox', { name: 'Bomb location' }))
    await user.click(
      screen.getByRole('checkbox', { name: 'Last defender sighting' }),
    )
    expect(screen.getByText('2 of 2 selected')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Selection ready for the decision step',
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
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/attempts', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'a'.repeat(43),
      },
      body: JSON.stringify({ edition_id: 'edition_001' }),
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
      'The case could not be started. Please try again.',
    )
  })
})
