import type { PublicFollowup } from './public-followup'
import { describe, expect, it } from 'vitest'

import {
  rubricCoversMainAnswer,
  scoringInputFor,
  serverRubricSchema,
} from './server-rubric'

const rubric = {
  schemaVersion: 1,
  caseRevision: 'case_revision_001',
  rubricRevision: 'rubric_revision_001',
  dimensions: [
    { id: 'timing', weight: 60 },
    { id: 'trade', weight: 40 },
  ],
  main: [
    {
      actionId: 'regroup_a',
      qualifierId: 'quiet',
      ratings: { timing: 4, trade: 3 },
      caps: [],
    },
  ],
  evidence: [
    {
      actionId: 'regroup_a',
      evidenceIds: ['utility', 'bomb_location'],
      points: 16,
    },
  ],
  followup: {
    type: 'new_information',
    responses: [
      { responseId: 'keep_original', quality: 58 },
      { responseId: 'change_mid', quality: 92 },
    ],
  },
} as const

describe('server rubric', () => {
  it('produces deterministic scoring input from frozen cells', () => {
    const parsed = serverRubricSchema.parse(rubric)

    expect(
      scoringInputFor(
        parsed,
        {
          action_id: 'regroup_a',
          qualifier_id: 'quiet',
          evidence_ids: ['bomb_location', 'utility'],
          confidence_id: 'fairly_sure',
        },
        {
          case_revision: 'case_revision_001',
          type: 'new_information',
          response_id: 'change_mid',
        },
      ),
    ).toEqual({
      weights: { timing: 60, trade: 40 },
      ratings: { timing: 4, trade: 3 },
      evidencePoints: 16,
      followupQuality: 92,
      caps: [],
      mainSharedConsensus: false,
      followupSharedConsensus: false,
    })
  })

  it('rejects inconsistent weights and dimensions', () => {
    expect(() =>
      serverRubricSchema.parse({
        ...rubric,
        dimensions: [
          { id: 'timing', weight: 60 },
          { id: 'trade', weight: 30 },
        ],
      }),
    ).toThrow()
    expect(() =>
      serverRubricSchema.parse({
        ...rubric,
        main: [{ ...rubric.main[0], ratings: { timing: 4 } }],
      }),
    ).toThrow()
    expect(() =>
      serverRubricSchema.parse({
        ...rubric,
        followup: {
          ...rubric.followup,
          responses: [
            {
              responseId: 'keep_original',
              quality: 58,
              sharedConsensus: true,
            },
            rubric.followup.responses[1],
          ],
        },
      }),
    ).toThrow()
  })

  it('returns null for an unlisted answer cell', () => {
    const parsed = serverRubricSchema.parse(rubric)

    expect(
      scoringInputFor(
        parsed,
        {
          action_id: 'regroup_a',
          qualifier_id: 'quiet',
          evidence_ids: ['bomb_location', 'utility'],
          confidence_id: 'fairly_sure',
        },
        {
          case_revision: 'case_revision_001',
          type: 'new_information',
          response_id: 'not_listed',
        },
      ),
    ).toBeNull()
  })
})

describe('rubricCoversMainAnswer', () => {
  const followup = {
    schemaVersion: 1,
    caseRevision: 'case_revision_001',
    type: 'new_information',
    updates: [],
    responses: [
      { id: 'keep_original', label: 'Keep the original line' },
      { id: 'change_mid', label: 'Change through mid' },
    ],
  } as unknown as PublicFollowup
  const answer = {
    action_id: 'regroup_a',
    qualifier_id: 'quiet',
    evidence_ids: ['utility', 'bomb_location'],
    confidence_id: 'fairly_sure',
  }

  it('accepts a covered action, qualifier and unordered evidence pair', () => {
    expect(rubricCoversMainAnswer(serverRubricSchema.parse(rubric), answer, followup)).toBe(true)
  })

  it.each([
    ['unknown qualifier', { ...answer, qualifier_id: 'fast' }],
    ['unknown action', { ...answer, action_id: 'hold_shape' }],
    ['uncovered evidence pair', { ...answer, evidence_ids: ['clock', 'spacing'] }],
    ['half-covered evidence pair', { ...answer, evidence_ids: ['bomb_location', 'clock'] }],
  ])('rejects an answer with an %s', (_label, candidate) => {
    expect(rubricCoversMainAnswer(serverRubricSchema.parse(rubric), candidate, followup)).toBe(false)
  })

  it('rejects when a published follow-up response has no rubric cell', () => {
    const extended = {
      ...followup,
      responses: [...(followup as { responses: unknown[] }).responses, { id: 'save', label: 'Save' }],
    } as unknown as PublicFollowup

    expect(rubricCoversMainAnswer(serverRubricSchema.parse(rubric), answer, extended)).toBe(false)
  })
})
