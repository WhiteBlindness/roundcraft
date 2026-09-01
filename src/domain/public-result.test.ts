import { describe, expect, it } from 'vitest'

import { outcomeBand } from './outcome-band'
import { publicResultSchema } from './public-result'

describe('public result', () => {
  it('uses the fixed tactical bands', () => {
    expect([100, 90, 89, 70, 69, 50, 49, 21, 20, 0].map(outcomeBand)).toEqual([
      'Best-supported',
      'Best-supported',
      'Defensible',
      'Defensible',
      'Conditional / high-variance',
      'Conditional / high-variance',
      'Weak',
      'Weak',
      'Not feasible',
      'Not feasible',
    ])
  })

  it('requires displayed components to equal the total', () => {
    expect(() =>
      publicResultSchema.parse({
        version: 1,
        total: 80,
        components: { main: 40, evidence: 15, followup: 24 },
        main_band: 'Defensible',
        followup_band: 'Best-supported',
        confidence_id: 'fairly_sure',
        mode: 'official',
        assisted: false,
        participation: 'awarded',
      }),
    ).toThrow()
  })
})
