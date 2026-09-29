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
              confidence: [
                { id: 'guessing', label: 'Guessing' },
                { id: 'leaning', label: 'Leaning' },
                { id: 'fairly_sure', label: 'Fairly sure' },
                { id: 'strong_read', label: 'Strong read' },
              ],
            },
          },
          error: null,
          meta: { request_id: crypto.randomUUID(), api_version: 'v1' },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ ok: true, data: { accepted: true }, error: null, meta: { request_id: crypto.randomUUID(), api_version: 'v1' } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          data: {
            attempt: {
              attempt_id: 'b'.repeat(43),
              state: 'main_locked',
              sequence: 1,
              main_committed_at: '2026-09-01T14:48:00.000Z',
            },
            main_answer: {
              action_id: 'a',
              qualifier_id: 'q1',
              evidence_ids: ['e1', 'e2'],
              confidence_id: 'fairly_sure',
            },
            followup: {
              schemaVersion: 1,
              caseRevision: 'case_revision_001',
              type: 'new_information',
              heading: 'The round changed',
              stimulus: 'Eight seconds pass before a defender is heard rotating.',
              updates: [
                {
                  id: 'rotation',
                  status: 'new',
                  text: 'A defender is heard leaving B.',
                },
              ],
              responses: [
                { id: 'keep_original', label: 'Keep the original line' },
                { id: 'change_mid', label: 'Change to pressure middle' },
              ],
            },
          },
          error: null,
          meta: { request_id: crypto.randomUUID(), api_version: 'v1' },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ ok: true, data: { accepted: true }, error: null, meta: { request_id: crypto.randomUUID(), api_version: 'v1' } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          data: {
            attempt: {
              attempt_id: 'b'.repeat(43),
              state: 'decision_complete',
              sequence: 2,
              followup_committed_at: '2026-09-01T14:49:00.000Z',
            },
            main_answer: {
              action_id: 'a',
              qualifier_id: 'q1',
              evidence_ids: ['e1', 'e2'],
              confidence_id: 'fairly_sure',
            },
            followup_answer: {
              case_revision: 'case_revision_001',
              type: 'new_information',
              response_id: 'change_mid',
            },
            result: {
              version: 1,
              total: 89,
              components: { main: 45, evidence: 16, followup: 28 },
              main_band: 'Best-supported',
              followup_band: 'Best-supported',
              confidence_id: 'fairly_sure',
              mode: 'official',
              assisted: false,
              participation: 'awarded',
            },
            reveal: {
              schemaVersion: 1,
              caseRevision: 'case_revision_001',
              continuation: {
                kind: 'authored',
                events: [
                  {
                    timestamp: '00:23',
                    action: 'The pair re-cleared middle.',
                    consequence: 'The rotation was confirmed.',
                    state: 'The round ended with a supported A split.',
                  },
                ],
              },
              comparison: {
                roundAction: 'Re-clear middle before committing.',
                materialInformation: 'The new rotation sound.',
                roundFollowup: 'The authored line changed after the cue.',
              },
              debrief: {
                whyItWorks: 'It refreshes the oldest decisive information.',
                cost: 'It spends time.',
                assumption: 'The pair can trade.',
                breaksWhen: 'The clock no longer permits a second route.',
                evidenceReview: [
                  { evidenceId: 'e1', explanation: 'The bomb preserved both routes.' },
                  { evidenceId: 'e2', explanation: 'The sighting had aged.' },
                ],
                followupReview: 'The change responded to the new information.',
                strongestAlternative: 'Keep the line, but accelerate.',
                counterfactual: {
                  changedFact: 'Remove the sound cue.',
                  effect: 'Keeping the line becomes equally strong.',
                },
                method: 'Synthetic case reviewed against disclosed state only.',
                sources: [
                  { label: 'Roundcraft method', detail: 'Synthetic continuation.' },
                ],
              },
              principle:
                'When new information invalidates the route assumption, refresh the decision before committing the remaining time.',
            },
          },
          error: null,
          meta: { request_id: crypto.randomUUID(), api_version: 'v1' },
        }),
      )
      .mockResolvedValue(
        Response.json({
          ok: true,
          data: { accepted: true },
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
    await user.click(screen.getByRole('button', { name: 'Continue to call' }))
    expect(screen.getByRole('heading', { name: 'Make the call' })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Regroup toward A' }))
    await user.click(screen.getByRole('radio', { name: 'Quietly' }))
    await user.click(screen.getByRole('radio', { name: 'Fairly sure' }))
    await user.click(screen.getByRole('button', { name: 'Review call' }))

    expect(
      screen.getByRole('heading', { name: 'Review your line' }),
    ).toBeInTheDocument()
    expect(screen.getByText('You cannot change this official line after it is locked.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lock main call' }))

    expect(
      await screen.findByRole('heading', { name: 'The round changed' }),
    ).toHaveFocus()
    expect(screen.getByText('Main locked')).toBeInTheDocument()
    expect(screen.getByText('A defender is heard leaving B.')).toBeInTheDocument()
    await user.click(
      screen.getByRole('radio', { name: 'Change to pressure middle' }),
    )
    await user.click(screen.getByRole('button', { name: 'Review update' }))
    expect(
      screen.getByRole('heading', { name: 'Review your update' }),
    ).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Lock follow-up' }))
    expect(
      await screen.findByRole('heading', {
        name: 'What actually happened',
        level: 1,
      }),
    ).toHaveFocus()
    expect(screen.getByText('89')).toBeInTheDocument()
    expect(screen.getByText('Participation')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'What to remember from this round' }),
    ).toBeInTheDocument()
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
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      `/api/v1/attempts/${'b'.repeat(43)}/main-commit`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': expect.any(String),
          'if-match': '"0"',
          'x-csrf-token': 'a'.repeat(43),
        },
        body: JSON.stringify({
          case_revision: 'case_revision_001',
          action_id: 'a',
          qualifier_id: 'q1',
          evidence_ids: ['e1', 'e2'],
          confidence_id: 'fairly_sure',
        }),
      },
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      `/api/v1/attempts/${'b'.repeat(43)}/followup-commit`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': expect.any(String),
          'if-match': '"1"',
          'x-csrf-token': 'a'.repeat(43),
        },
        body: JSON.stringify({
          case_revision: 'case_revision_001',
          type: 'new_information',
          response_id: 'change_mid',
        }),
      },
    )
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
      'The case could not be started. Try again in a moment',
    )
  })
})
