import { z } from 'zod'

const identifierSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_]+$/)
const proseSchema = z.string().min(1).max(1_200)

const eventSchema = z
  .object({
    timestamp: z.string().min(1).max(40),
    action: proseSchema,
    consequence: proseSchema,
    state: proseSchema,
  })
  .strict()

const evidenceReviewSchema = z
  .object({
    evidenceId: identifierSchema,
    explanation: proseSchema,
  })
  .strict()

const sourceSchema = z
  .object({
    label: z.string().min(1).max(160),
    detail: z.string().min(1).max(500),
  })
  .strict()

export const publicRevealSchema = z
  .object({
    schemaVersion: z.literal(1),
    caseRevision: identifierSchema,
    continuation: z
      .object({
        kind: z.enum(['authored', 'observed']),
        events: z.array(eventSchema).min(1).max(12),
      })
      .strict(),
    comparison: z
      .object({
        roundAction: proseSchema,
        materialInformation: proseSchema,
        roundFollowup: proseSchema,
      })
      .strict(),
    debrief: z
      .object({
        whyItWorks: proseSchema,
        cost: proseSchema,
        assumption: proseSchema,
        breaksWhen: proseSchema,
        evidenceReview: z.array(evidenceReviewSchema).min(1).max(5),
        followupReview: proseSchema,
        strongestAlternative: proseSchema,
        counterfactual: z
          .object({
            changedFact: proseSchema,
            effect: proseSchema,
          })
          .strict(),
        method: proseSchema,
        sources: z.array(sourceSchema).min(1).max(12),
      })
      .strict(),
    principle: z.string().min(18).max(320),
  })
  .strict()

export type PublicReveal = z.infer<typeof publicRevealSchema>
