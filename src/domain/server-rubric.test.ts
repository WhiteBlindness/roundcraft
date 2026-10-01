import type { PublicFollowup } from './public-followup'
import { describe, expect, it } from 'vitest'

import {
  rubricCoversMainAnswer,
  scoringInputFor,
  serverRubricSchema,
} from './server-rubric'

const rubric = {
  schemaVersion: 2,
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
    {
      actionId: 'hold_b',
      qualifierId: 'quiet',
      ratings: { timing: 1, trade: 2 },
      caps: [],
    },
  ],
  evidence: [
    {
      actionId: 'regroup_a',
      evidenceIds: ['utility', 'bomb_location'],
      points: 16,
    },
    {
      actionId: 'hold_b',
      evidenceIds: ['utility', 'bomb_location'],
      points: 8,
    },
  ],
  followup: {
    type: 'new_information',
    responses: [
      { actionId: 'regroup_a', responseId: 'keep_original', quality: 92 },
      { actionId: 'regroup_a', responseId: 'change_mid', quality: 58 },
      { actionId: 'hold_b', responseId: 'keep_original', quality: 20 },
      { actionId: 'hold_b', responseId: 'change_mid', quality: 85 },
    ],
  },
} as const

const regroupQuiet = {
  action_id: 'regroup_a',
  qualifier_id: 'quiet',
  evidence_ids: ['bomb_location', 'utility'] as [string, string],
  confidence_id: 'fairly_sure',
}

const respond = (responseId: string) => ({
  case_revision: 'case_revision_001',
  type: 'new_information' as const,
  response_id: responseId,
})

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
          response_id: 'keep_original',
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
              actionId: 'regroup_a',
              responseId: 'change_mid',
              quality: 58,
              sharedConsensus: true,
            },
            ...rubric.followup.responses.slice(2),
          ],
        },
      }),
    ).toThrow()
  })

  it('scores the same follow-up response against the main action it follows', () => {
    const parsed = serverRubricSchema.parse(rubric)
    const holdQuiet = { ...regroupQuiet, action_id: 'hold_b' }

    expect(scoringInputFor(parsed, regroupQuiet, respond('keep_original'))?.followupQuality).toBe(92)
    expect(scoringInputFor(parsed, holdQuiet, respond('keep_original'))?.followupQuality).toBe(20)
    expect(scoringInputFor(parsed, regroupQuiet, respond('change_mid'))?.followupQuality).toBe(58)
    expect(scoringInputFor(parsed, holdQuiet, respond('change_mid'))?.followupQuality).toBe(85)
  })

  it('rejects the version 1 shape whose follow-up ignores the main action', () => {
    expect(() =>
      serverRubricSchema.parse({
        ...rubric,
        schemaVersion: 1,
      }),
    ).toThrow()
    expect(() =>
      serverRubricSchema.parse({
        ...rubric,
        followup: {
          type: 'new_information',
          responses: [
            { responseId: 'keep_original', quality: 58 },
            { responseId: 'change_mid', quality: 92 },
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

  it('rejects a main action whose follow-up cells are missing', () => {
    const partial = serverRubricSchema.parse({
      ...rubric,
      followup: {
        type: 'new_information',
        responses: rubric.followup.responses.filter(
          ({ actionId, responseId }) => !(actionId === 'hold_b' && responseId === 'change_mid'),
        ),
      },
    })

    expect(rubricCoversMainAnswer(partial, answer, followup)).toBe(true)
    expect(rubricCoversMainAnswer(partial, { ...answer, action_id: 'hold_b' }, followup)).toBe(false)
  })
})
