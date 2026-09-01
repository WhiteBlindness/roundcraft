import { describe, expect, it } from 'vitest'

import { scoreDecision } from './scoring'

const defaultWeights = {
  objective: 25,
  information: 20,
  timing: 15,
  coordination: 15,
  economy: 10,
  risk: 10,
  resources: 5,
} as const

describe('scoreDecision', () => {
  it('returns the maximum 50/20/30 result', () => {
    const result = scoreDecision({
      weights: defaultWeights,
      ratings: {
        objective: 4,
        information: 4,
        timing: 4,
        coordination: 4,
        economy: 4,
        risk: 4,
        resources: 4,
      },
      evidencePoints: 20,
      followupQuality: 100,
      caps: [],
    })

    expect(result).toEqual({
      qualityQuarterUnits: 400,
      exactTotalUnits: 20_000,
      total: 100,
      components: { main: 50, evidence: 20, followup: 30 },
    })
  })

  it('rounds exact half points upward without floating point arithmetic', () => {
    const result = scoreDecision({
      weights: defaultWeights,
      ratings: {
        objective: 4,
        information: 0,
        timing: 0,
        coordination: 0,
        economy: 0,
        risk: 0,
        resources: 0,
      },
      evidencePoints: 0,
      followupQuality: 0,
      caps: [],
    })

    expect(result.total).toBe(13)
    expect(result.components).toEqual({ main: 13, evidence: 0, followup: 0 })
  })

  it('applies the lowest quality cap before scaling', () => {
    const result = scoreDecision({
      weights: defaultWeights,
      ratings: {
        objective: 4,
        information: 4,
        timing: 4,
        coordination: 4,
        economy: 4,
        risk: 4,
        resources: 4,
      },
      evidencePoints: 0,
      followupQuality: 0,
      caps: [55, 35],
    })

    expect(result.qualityQuarterUnits).toBe(140)
    expect(result.total).toBe(18)
  })

  it('uses largest remainders so displayed components sum to the total', () => {
    const result = scoreDecision({
      weights: defaultWeights,
      ratings: {
        objective: 2,
        information: 2,
        timing: 2,
        coordination: 2,
        economy: 2,
        risk: 2,
        resources: 2,
      },
      evidencePoints: 7,
      followupQuality: 33,
      caps: [],
    })

    expect(result.total).toBe(42)
    expect(result.components).toEqual({ main: 25, evidence: 7, followup: 10 })
  })

  it('rejects incomplete weights and out-of-range authored values', () => {
    expect(() =>
      scoreDecision({
        weights: { ...defaultWeights, objective: 24 },
        ratings: {
          objective: 4,
          information: 4,
          timing: 4,
          coordination: 4,
          economy: 4,
          risk: 4,
          resources: 4,
        },
        evidencePoints: 21,
        followupQuality: 101,
        caps: [],
      }),
    ).toThrow('Invalid scoring input')
  })
})
