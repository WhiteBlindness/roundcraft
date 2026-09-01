import { z } from 'zod'

const identifierSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_]+$/)

export const outcomeBandSchema = z.enum([
  'Best-supported',
  'Equally strong',
  'Defensible',
  'Conditional / high-variance',
  'Weak',
  'Not feasible',
])

export const publicResultSchema = z
  .object({
    version: z.number().int().positive(),
    total: z.number().int().min(0).max(100),
    components: z
      .object({
        main: z.number().int().min(0).max(50),
        evidence: z.number().int().min(0).max(20),
        followup: z.number().int().min(0).max(30),
      })
      .strict(),
    main_band: outcomeBandSchema,
    followup_band: outcomeBandSchema,
    confidence_id: identifierSchema,
    mode: z.literal('official'),
    assisted: z.boolean(),
    participation: z.literal('awarded'),
  })
  .strict()
  .superRefine((result, context) => {
    if (
      result.components.main +
        result.components.evidence +
        result.components.followup !==
      result.total
    ) {
      context.addIssue({ code: 'custom', message: 'Result components must sum to total' })
    }
  })

export type PublicResult = z.infer<typeof publicResultSchema>
