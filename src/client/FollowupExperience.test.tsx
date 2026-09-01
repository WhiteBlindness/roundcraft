import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PublicBrief } from '../domain/public-brief'
import type { MainCommitData } from './api'
import { FollowupExperience } from './FollowupExperience'

const brief: PublicBrief = {
  schemaVersion: 1,
  editionId: 'edition_001',
  caseRevision: 'case_revision_001',
  title: 'The last smoke',
  focus: 'Resource allocation under uncertainty',
  origin: 'synthetic',
  facts: [{ id: 'bomb', status: 'confirmed', text: 'The bomb is outside B.' }],
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
    { id: 'e2', label: 'Last sighting' },
    { id: 'e3', label: 'Utility' },
    { id: 'e4', label: 'Clock' },
    { id: 'e5', label: 'Spacing' },
  ],
  confidence: [
    { id: 'guessing', label: 'Guessing' },
    { id: 'leaning', label: 'Leaning' },
    { id: 'fairly_sure', label: 'Fairly sure' },
    { id: 'strong_read', label: 'Strong read' },
  ],
}

const mainCommit: MainCommitData = {
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
    stimulus: 'A defender is heard rotating.',
    updates: [{ id: 'rotation', status: 'new', text: 'The B defender moved.' }],
    responses: [
      { id: 'keep_original', label: 'Keep the original line' },
      { id: 'change_mid', label: 'Change to pressure middle' },
    ],
  },
}

const resultResponse = {
  ok: true,
  data: {
    attempt: {
      attempt_id: 'b'.repeat(43),
      state: 'decision_complete',
      sequence: 2,
      followup_committed_at: '2026-09-01T14:49:00.000Z',
    },
    main_answer: mainCommit.main_answer,
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
            state: 'The A split was supported.',
          },
        ],
      },
      comparison: {
        roundAction: 'Re-clear middle.',
        materialInformation: 'The rotation sound.',
        roundFollowup: 'Change the original line.',
      },
      debrief: {
        whyItWorks: 'It refreshes old information.',
        cost: 'It spends time.',
        assumption: 'The pair can trade.',
        breaksWhen: 'The clock is too low.',
        evidenceReview: [
          { evidenceId: 'e1', explanation: 'The bomb preserves both routes.' },
          { evidenceId: 'e2', explanation: 'The sighting has aged.' },
        ],
        followupReview: 'The new cue changes the route assumption.',
        strongestAlternative: 'Keep the line and accelerate.',
        counterfactual: {
          changedFact: 'Remove the sound.',
          effect: 'Keeping the line becomes equally strong.',
        },
        method: 'Synthetic case reviewed against disclosed state.',
        sources: [{ label: 'Method', detail: 'Synthetic continuation.' }],
      },
      principle:
        'When a new cue invalidates the route assumption, refresh the decision before spending the remaining time.',
    },
  },
  error: null,
  meta: { request_id: crypto.randomUUID(), api_version: 'v1' },
} as const

describe('FollowupExperience', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('freezes a pending result and retries with the same key and body', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json(resultResponse))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <FollowupExperience
        attemptId={'b'.repeat(43)}
        csrfToken={'a'.repeat(43)}
        brief={brief}
        mainCommit={mainCommit}
        initialResult={null}
        onStageChange={vi.fn()}
      />,
    )

    await user.click(
      screen.getByRole('radio', { name: 'Change to pressure middle' }),
    )
    await user.click(screen.getByRole('button', { name: 'Review update' }))
    await user.click(screen.getByRole('button', { name: 'Lock follow-up' }))

    expect(await screen.findByText('Result pending')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit update' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Retry result' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Retry result' }))
    expect(
      await screen.findByRole('heading', {
        name: 'What actually happened',
        level: 1,
      }),
    ).toHaveFocus()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(fetchMock.mock.calls[1]?.[1])
  })
})
