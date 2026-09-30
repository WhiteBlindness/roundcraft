import { z } from 'zod'

import type { FollowupAnswer } from './followup-answer'
import type { MainAnswer } from './main-answer'
import type { PublicFollowup } from './public-followup'

const identifierSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_]+$/)

const dimensionSchema = z
  .object({
    id: identifierSchema,
    weight: z.number().int().min(0).max(100),
  })
  .strict()

const mainCellSchema = z
  .object({
    actionId: identifierSchema,
    qualifierId: identifierSchema,
    ratings: z.record(identifierSchema, z.number().int().min(0).max(4)),
    caps: z.array(z.number().int().min(0).max(100)).max(8),
    sharedConsensus: z.boolean().optional().default(false),
  })
  .strict()

const evidenceCellSchema = z
  .object({
    actionId: identifierSchema,
    evidenceIds: z
      .array(identifierSchema)
      .length(2)
      .refine((ids) => ids[0] !== ids[1]),
    points: z.number().int().min(0).max(20),
  })
  .strict()
  .transform((cell) => ({
    ...cell,
    evidenceIds: [...cell.evidenceIds].sort() as [string, string],
  }))

// Follow-up quality is judged against the line the player locked: the same
// response can be a sound correction after one main action and a needless
// reversal after another. Every cell is therefore keyed by the main action.
const newInformationRubricSchema = z
  .object({
    type: z.literal('new_information'),
    responses: z
      .array(
        z
          .object({
            actionId: identifierSchema,
            responseId: identifierSchema,
            quality: z.number().int().min(0).max(100),
            sharedConsensus: z.boolean().optional().default(false),
          })
          .strict(),
      )
      .min(2)
      .max(40),
  })
  .strict()

const economyRiskRubricSchema = z
  .object({
    type: z.literal('economy_risk'),
    pairs: z
      .array(
        z
          .object({
            actionId: identifierSchema,
            postureId: identifierSchema,
            priorityId: identifierSchema,
            quality: z.number().int().min(0).max(100),
            sharedConsensus: z.boolean().optional().default(false),
          })
          .strict(),
      )
      .min(1)
      .max(320),
  })
  .strict()

export const serverRubricSchema = z
  .object({
    schemaVersion: z.literal(2),
    caseRevision: identifierSchema,
    rubricRevision: identifierSchema,
    dimensions: z.array(dimensionSchema).min(1).max(12),
    main: z.array(mainCellSchema).min(1).max(20),
    evidence: z.array(evidenceCellSchema).min(1).max(50),
    followup: z.discriminatedUnion('type', [
      newInformationRubricSchema,
      economyRiskRubricSchema,
    ]),
  })
  .strict()
  .superRefine((rubric, context) => {
    const dimensionIds = rubric.dimensions.map(({ id }) => id)
    const weightTotal = rubric.dimensions.reduce(
      (total, { weight }) => total + weight,
      0,
    )
    const expectedDimensions = new Set(dimensionIds)
    const ratingsMatch = rubric.main.every(({ ratings }) => {
      const ratingIds = Object.keys(ratings)
      return (
        ratingIds.length === expectedDimensions.size &&
        ratingIds.every((id) => expectedDimensions.has(id))
      )
    })
    const weights = Object.fromEntries(
      rubric.dimensions.map(({ id, weight }) => [id, weight]),
    )
    const invalidSharedMain = rubric.main.some(({ ratings, caps, sharedConsensus }) => {
      if (!sharedConsensus) return false

      const rawQuarterUnits = Object.entries(ratings).reduce(
        (total, [dimension, rating]) => total + (weights[dimension] ?? 0) * rating,
        0,
      )
      const lowestCap = caps.length === 0 ? 100 : Math.min(...caps)

      return Math.min(rawQuarterUnits, lowestCap * 4) < 360
    })
    const followupCells =
      rubric.followup.type === 'new_information'
        ? rubric.followup.responses
        : rubric.followup.pairs
    const invalidSharedFollowup = followupCells.some(
      ({ quality, sharedConsensus }) => sharedConsensus && quality < 90,
    )

    if (
      weightTotal !== 100 ||
      new Set(dimensionIds).size !== dimensionIds.length ||
      !ratingsMatch ||
      invalidSharedMain ||
      invalidSharedFollowup
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Server rubric dimensions are inconsistent',
      })
    }
  })

export type ServerRubric = z.infer<typeof serverRubricSchema>

export function scoringInputFor(
  rubric: ServerRubric,
  mainAnswer: MainAnswer,
  followupAnswer: FollowupAnswer,
) {
  const mainCell = rubric.main.find(
    ({ actionId, qualifierId }) =>
      actionId === mainAnswer.action_id &&
      qualifierId === mainAnswer.qualifier_id,
  )
  const sortedEvidence = [...mainAnswer.evidence_ids].sort()
  const evidenceCell = rubric.evidence.find(
    ({ actionId, evidenceIds }) =>
      actionId === mainAnswer.action_id &&
      evidenceIds[0] === sortedEvidence[0] &&
      evidenceIds[1] === sortedEvidence[1],
  )
  const followupCell = (() => {
    if (
      rubric.followup.type === 'new_information' &&
      followupAnswer.type === 'new_information'
    ) {
      return rubric.followup.responses.find(
        ({ actionId, responseId }) =>
          actionId === mainAnswer.action_id &&
          responseId === followupAnswer.response_id,
      )
    }

    if (
      rubric.followup.type === 'economy_risk' &&
      followupAnswer.type === 'economy_risk'
    ) {
      return rubric.followup.pairs.find(
        ({ actionId, postureId, priorityId }) =>
          actionId === mainAnswer.action_id &&
          postureId === followupAnswer.posture_id &&
          priorityId === followupAnswer.priority_id,
      )
    }

    return undefined
  })()

  if (!mainCell || !evidenceCell || !followupCell) return null

  return {
    weights: Object.fromEntries(
      rubric.dimensions.map(({ id, weight }) => [id, weight]),
    ),
    ratings: mainCell.ratings,
    evidencePoints: evidenceCell.points,
    followupQuality: followupCell.quality,
    caps: mainCell.caps,
    mainSharedConsensus: mainCell.sharedConsensus,
    followupSharedConsensus: followupCell.sharedConsensus,
  } as const
}

export function publishedFollowupAnswers(
  followup: PublicFollowup,
): readonly FollowupAnswer[] {
  if (followup.type === 'new_information') {
    return followup.responses.map(({ id }) => ({
      case_revision: followup.caseRevision,
      type: 'new_information',
      response_id: id,
    }))
  }

  return followup.postures.flatMap(({ id: postureId }) =>
    followup.priorities.map(({ id: priorityId }) => ({
      case_revision: followup.caseRevision,
      type: 'economy_risk' as const,
      posture_id: postureId,
      priority_id: priorityId,
    })),
  )
}

/**
 * True when every published follow-up answer can be scored after this main
 * answer. Checked before the irreversible main lock, so a player can never be
 * stranded at the follow-up by a content gap.
 */
export function rubricCoversMainAnswer(
  rubric: ServerRubric,
  mainAnswer: MainAnswer,
  followup: PublicFollowup,
): boolean {
  const answers = publishedFollowupAnswers(followup)

  return (
    answers.length > 0 &&
    answers.every((answer) => scoringInputFor(rubric, mainAnswer, answer) !== null)
  )
}
