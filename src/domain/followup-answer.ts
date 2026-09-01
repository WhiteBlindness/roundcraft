import { z } from 'zod'

const identifierSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_]+$/)

const newInformationAnswerSchema = z
  .object({
    case_revision: identifierSchema,
    type: z.literal('new_information'),
    response_id: identifierSchema,
  })
  .strict()

const economyRiskAnswerSchema = z
  .object({
    case_revision: identifierSchema,
    type: z.literal('economy_risk'),
    posture_id: identifierSchema,
    priority_id: identifierSchema,
  })
  .strict()

export const followupAnswerSchema = z.discriminatedUnion('type', [
  newInformationAnswerSchema,
  economyRiskAnswerSchema,
])

export type FollowupAnswer = z.infer<typeof followupAnswerSchema>
