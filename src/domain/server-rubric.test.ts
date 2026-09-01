import { describe, expect, it } from 'vitest'

import { scoringInputFor, serverRubricSchema } from './server-rubric'

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
