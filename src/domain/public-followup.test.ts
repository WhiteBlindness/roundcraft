import { describe, expect, it } from 'vitest'

import { publicFollowupSchema } from './public-followup'

const followup = {
  schemaVersion: 1,
  caseRevision: 'case_rev_01',
  type: 'new_information',
  heading: 'The round changed',
  stimulus: 'Eight seconds pass before a defender is heard rotating.',
  updates: [
    { id: 'rotation', status: 'new', text: 'A defender is heard leaving B.' },
  ],
  responses: [
    { id: 'keep_original', label: 'Keep the original line' },
    { id: 'change_a', label: 'Change to pressure middle' },
  ],
} as const

describe('publicFollowupSchema', () => {
  it('accepts only the finite public follow-up projection', () => {
    expect(publicFollowupSchema.parse(followup)).toEqual(followup)
  })

  it('rejects hidden reveal and scoring fields', () => {
    expect(
      publicFollowupSchema.safeParse({
        ...followup,
        rubric: { preferredResponse: 'keep_original' },
      }).success,
    ).toBe(false)
  })

  it('rejects duplicate response identifiers', () => {
    expect(
      publicFollowupSchema.safeParse({
        ...followup,
        responses: [followup.responses[0], followup.responses[0]],
      }).success,
    ).toBe(false)
  })
})
