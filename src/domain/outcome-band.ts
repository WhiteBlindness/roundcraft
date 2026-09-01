import type { z } from 'zod'

import { outcomeBandSchema } from './public-result'

export function outcomeBand(value: number): z.infer<typeof outcomeBandSchema> {
  if (value >= 90) return 'Best-supported'
  if (value >= 70) return 'Defensible'
  if (value >= 50) return 'Conditional / high-variance'
  if (value >= 21) return 'Weak'
  return 'Not feasible'
}
