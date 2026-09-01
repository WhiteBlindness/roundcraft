import { z } from 'zod'

const identifierSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_]+$/)

const optionSchema = z
  .object({
    id: identifierSchema,
    label: z.string().min(1).max(160),
  })
  .strict()

const updateSchema = z
  .object({
    id: identifierSchema,
    status: z.enum(['new', 'changed', 'expired', 'unchanged']),
    text: z.string().min(1).max(500),
  })
  .strict()

export const publicFollowupSchema = z
  .object({
    schemaVersion: z.literal(1),
    caseRevision: identifierSchema,
    type: z.enum(['new_information', 'economy_risk']),
    heading: z.string().min(1).max(160),
    stimulus: z.string().min(1).max(800),
    updates: z.array(updateSchema).min(1).max(20),
    responses: z.array(optionSchema).min(2).max(8),
  })
  .strict()
  .superRefine((followup, context) => {
    const responseIds = followup.responses.map(({ id }) => id)
    const updateIds = followup.updates.map(({ id }) => id)

    if (
      new Set(responseIds).size !== responseIds.length ||
      new Set(updateIds).size !== updateIds.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Public follow-up identifiers must be unique within each group',
      })
    }
  })

export type PublicFollowup = z.infer<typeof publicFollowupSchema>
