// Rubric analysis shared by content:validate and content:score.
//
// Follow-up cells are keyed by main action × follow-up answer: the same answer
// can be a sound correction after one line and a needless reversal after
// another. These checks keep that relationship meaningful.

import type { FollowupAnswer } from '../../src/domain/followup-answer'
import type { PublicBrief } from '../../src/domain/public-brief'
import { scoreDecision } from '../../src/domain/scoring'
import type { ServerRubric } from '../../src/domain/server-rubric'

export interface Finding {
  readonly severity: 'error' | 'warning'
  readonly code: string
  readonly message: string
}

/** A follow-up answer counts as context-blind when it scores at least this… */
export const CONTEXT_BLIND_HIGH = 70
/** …and within this many points after two main actions… */
export const CONTEXT_BLIND_SPREAD = 5
/** …whose best lines differ by at least this much quality. */
export const MATERIAL_MAIN_GAP = 25
/** Below this spread, one locked line's follow-up answers barely change the score. */
export const FLAT_ROW_SPREAD = 20

export function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return [...repeated]
}

export function sample<T>(items: readonly T[], size = 4): string {
  const shown = items.slice(0, size).map(String).join(', ')
  return items.length > size ? `${shown}, … (+${items.length - size})` : shown
}

export function followupKey(answer: FollowupAnswer): string {
  return answer.type === 'new_information'
    ? answer.response_id
    : `${answer.posture_id}|${answer.priority_id}`
}

export interface FollowupCell {
  readonly actionId: string
  readonly key: string
  readonly quality: number
}

export function followupCells(rubric: ServerRubric): FollowupCell[] {
  return rubric.followup.type === 'new_information'
    ? rubric.followup.responses.map(({ actionId, responseId, quality }) => ({ actionId, key: responseId, quality }))
    : rubric.followup.pairs.map(({ actionId, postureId, priorityId, quality }) => ({
        actionId,
        key: `${postureId}|${priorityId}`,
        quality,
      }))
}

/** Quality (0–100, caps applied) of every published action × qualifier line. */
export function mainLineQualities(rubric: ServerRubric): Map<string, number> {
  const quality = new Map<string, number>()
  const weights = Object.fromEntries(rubric.dimensions.map(({ id, weight }) => [id, weight]))
  for (const cell of rubric.main) {
    try {
      const quarter = scoreDecision({ weights, ratings: cell.ratings, evidencePoints: 0, followupQuality: 0, caps: cell.caps })
        .qualityQuarterUnits
      quality.set(`${cell.actionId}/${cell.qualifierId}`, quarter / 4)
    } catch {
      // Reported by the rubric schema checks.
    }
  }
  return quality
}

export function bestLineByAction(brief: PublicBrief, lineQuality: Map<string, number>): Map<string, number> {
  return new Map(
    brief.actions.map((action) => [
      action.id,
      Math.max(0, ...action.qualifierIds.map((qualifierId) => lineQuality.get(`${action.id}/${qualifierId}`) ?? 0)),
    ]),
  )
}

/**
 * Coverage and shape of the follow-up matrix. Errors: a missing, unknown or
 * repeated main action × answer cell, or a matrix in which every answer scores
 * the same whatever the main call was. Warnings: a locked line whose answers
 * barely differ, or an answer that scores high and nearly the same after main
 * actions of clearly different quality.
 */
export function followupMatrixFindings(
  brief: PublicBrief,
  rubric: ServerRubric,
  answers: readonly FollowupAnswer[],
): Finding[] {
  const findings: Finding[] = []
  const error = (code: string, message: string) => findings.push({ severity: 'error', code, message })
  const warn = (code: string, message: string) => findings.push({ severity: 'warning', code, message })

  const cells = followupCells(rubric)
  const answerKeys = answers.map((answer) => followupKey(answer))
  const expected = brief.actions.flatMap((action) => answerKeys.map((key) => `${action.id} × ${key}`))
  const actual = cells.map(({ actionId, key }) => `${actionId} × ${key}`)
  const missing = expected.filter((key) => !actual.includes(key))
  const extra = actual.filter((key) => !expected.includes(key))
  const repeated = duplicates(actual)
  if (missing.length > 0) {
    error(
      'followup_incomplete',
      `rubric.followup covers ${expected.length - missing.length} of ${expected.length} main action × follow-up answer cells; missing: ${sample(missing)}`,
    )
  }
  if (extra.length > 0) error('followup_extra', `rubric.followup covers unpublished actions or answers: ${sample(extra)}`)
  if (repeated.length > 0) error('followup_duplicate', `rubric.followup repeats cells: ${sample(repeated)}`)
  if (findings.length > 0) return findings

  const quality = new Map(cells.map(({ actionId, key, quality: value }) => [`${actionId} × ${key}`, value]))
  const at = (actionId: string, key: string) => quality.get(`${actionId} × ${key}`) ?? 0

  // The shape this contract replaces: every answer scores the same whatever the main call was.
  if (
    brief.actions.length > 1 &&
    answerKeys.every((key) => new Set(brief.actions.map(({ id }) => at(id, key))).size === 1)
  ) {
    error(
      'followup_ignores_main_call',
      'every follow-up answer scores the same after every main action; the follow-up must be judged against the line the player locked',
    )
    return findings
  }

  for (const action of brief.actions) {
    const values = answerKeys.map((key) => at(action.id, key))
    if (values.length > 1 && Math.max(...values) - Math.min(...values) < FLAT_ROW_SPREAD) {
      warn(
        'followup_flat',
        `after "${action.id}" the follow-up answers differ by less than ${FLAT_ROW_SPREAD} points: the follow-up barely changes the score`,
      )
    }
  }

  const bestByAction = bestLineByAction(brief, mainLineQualities(rubric))
  const blind = answerKeys.filter((key) =>
    brief.actions.some((left) =>
      brief.actions.some((right) => {
        if (left.id >= right.id) return false
        const gap = Math.abs((bestByAction.get(left.id) ?? 0) - (bestByAction.get(right.id) ?? 0))
        const [a, b] = [at(left.id, key), at(right.id, key)]
        return (
          gap >= MATERIAL_MAIN_GAP &&
          a >= CONTEXT_BLIND_HIGH &&
          b >= CONTEXT_BLIND_HIGH &&
          Math.abs(a - b) <= CONTEXT_BLIND_SPREAD
        )
      }),
    ),
  )
  if (blind.length > 0) {
    warn(
      'followup_context_blind',
      `follow-up answer(s) ${sample(blind)} score high and nearly the same after main actions whose quality differs by ${MATERIAL_MAIN_GAP}+ points; check that the follow-up rewards adaptation, not a word`,
    )
  }
  return findings
}
