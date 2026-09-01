import { describe, expect, it } from 'vitest'

import { publicBriefSchema } from './public-brief'

const validBrief = {
  schemaVersion: 1,
  editionId: 'edition_2026_09_01',
  caseRevision: 'case_rev_01',
  title: 'The last smoke',
  focus: 'Resource allocation under uncertainty',
  origin: 'synthetic',
  facts: [
    { id: 'fact_a', status: 'confirmed', text: 'The bomb is down.' },
    { id: 'fact_b', status: 'last_seen', text: 'One defender was seen B.' },
  ],
  actions: [
    {
      id: 'action_a',
      label: 'Regroup toward A',
      qualifierIds: ['quiet', 'fast'],
    },
    {
      id: 'action_b',
      label: 'Pressure middle',
      qualifierIds: ['paired', 'delayed'],
    },
    {
      id: 'action_c',
      label: 'Hold the current shape',
      qualifierIds: ['passive', 'contact'],
    },
  ],
  qualifiers: [
    { id: 'quiet', label: 'Quietly' },
    { id: 'fast', label: 'Immediately' },
    { id: 'paired', label: 'As a pair' },
    { id: 'delayed', label: 'After a delay' },
    { id: 'passive', label: 'Without taking space' },
    { id: 'contact', label: 'On contact' },
  ],
  evidence: [
    { id: 'e1', label: 'Bomb location' },
    { id: 'e2', label: 'Last defender sighting' },
    { id: 'e3', label: 'Remaining smoke' },
    { id: 'e4', label: 'Round clock' },
    { id: 'e5', label: 'Trade spacing' },
  ],
  confidence: [
    { id: 'guessing', label: 'Guessing' },
    { id: 'leaning', label: 'Leaning' },
    { id: 'fairly_sure', label: 'Fairly sure' },
    { id: 'strong_read', label: 'Strong read' },
  ],
} as const

describe('publicBriefSchema', () => {
  it('accepts a bounded synthetic public brief', () => {
    expect(publicBriefSchema.parse(validBrief)).toEqual(validBrief)
  })

  it('requires exactly five evidence choices', () => {
    const invalidBrief = {
      ...validBrief,
      evidence: validBrief.evidence.slice(0, 4),
    }

    expect(publicBriefSchema.safeParse(invalidBrief).success).toBe(false)
  })

  it('rejects server-only scoring fields instead of stripping them', () => {
    const leakedBrief = {
      ...validBrief,
      rubric: { preferredActionId: 'action_a' },
    }

    expect(publicBriefSchema.safeParse(leakedBrief).success).toBe(false)
  })

  it('requires exactly four distinct confidence labels', () => {
    const invalidBrief = {
      ...validBrief,
      confidence: [
        validBrief.confidence[0],
        validBrief.confidence[0],
        validBrief.confidence[2],
        validBrief.confidence[3],
      ],
    }

    expect(publicBriefSchema.safeParse(invalidBrief).success).toBe(false)
  })
})
