import { z } from 'zod'

const identifierSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_]+$/)

const factSchema = z
  .object({
    id: identifierSchema,
    status: z.enum(['confirmed', 'last_seen', 'inferred', 'unknown']),
    text: z.string().min(1).max(500),
  })
  .strict()

const actionSchema = z
  .object({
    id: identifierSchema,
    label: z.string().min(1).max(120),
    qualifierIds: z.array(identifierSchema).min(2).max(4),
  })
  .strict()

const optionSchema = z
  .object({
    id: identifierSchema,
    label: z.string().min(1).max(160),
  })
  .strict()

function containsDuplicates(values: readonly string[]) {
  return new Set(values).size !== values.length
}

export const publicBriefSchema = z
  .object({
    schemaVersion: z.literal(1),
    editionId: identifierSchema,
    caseRevision: identifierSchema,
    title: z.string().min(1).max(160),
    focus: z.string().min(1).max(240),
    origin: z.enum(['synthetic', 'professional']),
    facts: z.array(factSchema).min(1).max(30),
    actions: z.array(actionSchema).min(3).max(5),
    qualifiers: z.array(optionSchema).min(2).max(20),
    evidence: z.array(optionSchema).length(5),
    confidence: z.array(optionSchema).length(4),
  })
  .strict()
  .superRefine((brief, context) => {
    const actionIds = brief.actions.map(({ id }) => id)
    const qualifierIds = brief.qualifiers.map(({ id }) => id)
    const evidenceIds = brief.evidence.map(({ id }) => id)
    const factIds = brief.facts.map(({ id }) => id)
    const confidenceIds = brief.confidence.map(({ id }) => id)
    const qualifierIdSet = new Set(qualifierIds)

    if (
      containsDuplicates(actionIds) ||
      containsDuplicates(qualifierIds) ||
      containsDuplicates(evidenceIds) ||
      containsDuplicates(factIds) ||
      containsDuplicates(confidenceIds)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Public brief identifiers must be unique within each group',
      })
    }

    brief.actions.forEach((action, actionIndex) => {
      if (
        containsDuplicates(action.qualifierIds) ||
        action.qualifierIds.some((id) => !qualifierIdSet.has(id))
      ) {
        context.addIssue({
          code: 'custom',
          path: ['actions', actionIndex, 'qualifierIds'],
          message: 'Actions must reference distinct published qualifiers',
        })
      }
    })
  })

export type PublicBrief = z.infer<typeof publicBriefSchema>
