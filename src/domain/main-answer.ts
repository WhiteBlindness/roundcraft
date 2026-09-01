import { z } from 'zod'

import type { PublicBrief } from './public-brief'

const identifierSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_]+$/)

export const mainAnswerSchema = z
  .object({
    action_id: identifierSchema,
    qualifier_id: identifierSchema,
    evidence_ids: z
      .array(identifierSchema)
      .length(2)
      .refine((ids) => ids[0] !== ids[1]),
    confidence_id: identifierSchema,
  })
  .strict()

export const mainCommitBodySchema = mainAnswerSchema
  .extend({ case_revision: identifierSchema })
  .strict()
  .transform((body) => ({
    ...body,
    evidence_ids: [...body.evidence_ids].sort() as [string, string],
  }))

export type MainAnswer = z.infer<typeof mainAnswerSchema>
export type MainCommitBody = z.output<typeof mainCommitBodySchema>

export function isPublishedMainAnswer(
  body: MainCommitBody,
  brief: PublicBrief,
): boolean {
  const action = brief.actions.find(({ id }) => id === body.action_id)
  const evidenceIds = new Set(brief.evidence.map(({ id }) => id))
  const confidenceIds = new Set(brief.confidence.map(({ id }) => id))

  return Boolean(
    body.case_revision === brief.caseRevision &&
      action?.qualifierIds.includes(body.qualifier_id) &&
      body.evidence_ids.every((id) => evidenceIds.has(id)) &&
      confidenceIds.has(body.confidence_id),
  )
}
