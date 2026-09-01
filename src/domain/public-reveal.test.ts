import { describe, expect, it } from 'vitest'

import { publicRevealSchema } from './public-reveal'

const reveal = {
  schemaVersion: 1,
  caseRevision: 'case_revision_001',
  continuation: {
    kind: 'authored',
    events: [
      {
        timestamp: '00:23',
        action: 'The pair re-cleared middle.',
        consequence: 'The rotation was confirmed before the final commitment.',
        state: 'The round ended with a supported A split.',
      },
    ],
  },
  comparison: {
    roundAction: 'Re-clear middle before committing.',
    materialInformation: 'The aged B sighting and the new rotation sound.',
    roundFollowup: 'The authored line changed after the new sound cue.',
  },
  debrief: {
    whyItWorks: 'It refreshes the oldest decisive information.',
    cost: 'It spends time and gives up immediate site pressure.',
    assumption: 'The pair can trade the re-clear.',
    breaksWhen: 'The clock no longer permits a second route.',
    evidenceReview: [
      {
        evidenceId: 'bomb_location',
        explanation: 'The bomb position preserved both routes.',
      },
      {
        evidenceId: 'utility',
        explanation: 'The smoke made the re-clear survivable.',
      },
    ],
    followupReview: 'Changing line responded directly to the new information.',
    strongestAlternative: 'Keep the line, but accelerate before the cue ages.',
    counterfactual: {
      changedFact: 'Remove the rotation sound.',
      effect: 'Keeping the original line becomes equally strong.',
    },
    method: 'Synthetic case reviewed against the disclosed state only.',
    sources: [
      { label: 'Roundcraft method', detail: 'Synthetic authored continuation.' },
    ],
  },
  principle:
    'When new information invalidates the route assumption, refresh the decision before committing the remaining time.',
} as const

describe('public reveal', () => {
  it('accepts only the authorised reveal projection', () => {
    expect(publicRevealSchema.parse(reveal)).toEqual(reveal)
  })

  it('rejects scoring and governance fields', () => {
    expect(() =>
      publicRevealSchema.parse({ ...reveal, serverScoring: { preferred: true } }),
    ).toThrow()
    expect(() =>
      publicRevealSchema.parse({ ...reveal, reviewerContact: 'private@example.test' }),
    ).toThrow()
  })
})
