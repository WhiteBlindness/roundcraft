import { describe, expect, it } from 'vitest'

import {
  followupAnswerSchema,
} from './followup-answer'
import { isPublishedFollowupAnswer } from './followup-validation'
import { publicFollowupSchema } from './public-followup'

describe('follow-up answers', () => {
  it('accepts only a published New Information response', () => {
    const followup = publicFollowupSchema.parse({
      schemaVersion: 1,
      caseRevision: 'case_revision_001',
      type: 'new_information',
      heading: 'The round changed',
      stimulus: 'A new sound cue changes the information state.',
      updates: [{ id: 'sound', status: 'new', text: 'A rotation is heard.' }],
      responses: [
        { id: 'keep_original', label: 'Keep the original line' },
        { id: 'change_mid', label: 'Change to pressure middle' },
      ],
    })
    const answer = followupAnswerSchema.parse({
      case_revision: 'case_revision_001',
      type: 'new_information',
      response_id: 'change_mid',
    })

    expect(isPublishedFollowupAnswer(answer, followup)).toBe(true)
    expect(
      isPublishedFollowupAnswer(
        {
          case_revision: 'case_revision_001',
          type: 'new_information',
          response_id: 'hidden',
        },
        followup,
      ),
    ).toBe(false)
  })

  it('accepts only a published Economy/Risk posture and priority pair', () => {
    const followup = publicFollowupSchema.parse({
      schemaVersion: 1,
      caseRevision: 'case_revision_002',
      type: 'economy_risk',
      heading: 'Choose the risk posture',
      stimulus: 'The current buy changes the next-round reserve.',
      updates: [{ id: 'reserve', status: 'changed', text: 'Reserve: $2,100.' }],
      postures: [
        { id: 'protect', label: 'Protect the next buy' },
        { id: 'press', label: 'Press this round' },
      ],
      priorities: [
        { id: 'utility', label: 'Keep utility' },
        { id: 'rifle', label: 'Keep the rifle' },
      ],
    })
    const answer = followupAnswerSchema.parse({
      case_revision: 'case_revision_002',
      type: 'economy_risk',
      posture_id: 'protect',
      priority_id: 'utility',
    })

    expect(isPublishedFollowupAnswer(answer, followup)).toBe(true)
    expect(
      isPublishedFollowupAnswer(
        {
          case_revision: 'case_revision_002',
          type: 'economy_risk',
          posture_id: 'protect',
          priority_id: 'armour',
        },
        followup,
      ),
    ).toBe(false)
  })

  it('rejects mixed and extra fields', () => {
    expect(() =>
      followupAnswerSchema.parse({
        case_revision: 'case_revision_001',
        type: 'new_information',
        response_id: 'keep_original',
        priority_id: 'utility',
      }),
    ).toThrow()
  })
})
