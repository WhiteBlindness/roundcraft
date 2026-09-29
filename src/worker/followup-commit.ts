import { z } from 'zod'

import {
  followupAnswerSchema,
  type FollowupAnswer,
} from '../domain/followup-answer'
import { isPublishedFollowupAnswer } from '../domain/followup-validation'
import { mainAnswerSchema, type MainAnswer } from '../domain/main-answer'
import { outcomeBand } from '../domain/outcome-band'
import { publicFollowupSchema, type PublicFollowup } from '../domain/public-followup'
import { publicResultSchema } from '../domain/public-result'
import { publicRevealSchema } from '../domain/public-reveal'
import { scoreDecision } from '../domain/scoring'
import {
  scoringInputFor,
  serverRubricSchema,
  type ServerRubric,
} from '../domain/server-rubric'
import type { Bindings } from './bindings'
import { authenticateIdentity, verifyCsrfToken } from './identity'
import { apiMeta, jsonError, sha256Base64Url } from './http'
import {
  errorLogFields,
  logEvent,
  requestLogContext,
  type LogContext,
} from './log'
import {
  acceptsStateChangingHeaders,
  maximumStateChangingBodyBytes,
} from './request-protection'

const attemptPattern = /^[A-Za-z0-9_-]{43}$/
const idempotencyKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface FollowupCommitProjectionRecord {
  readonly attempt_id: string
  readonly identity_id: string
  readonly edition_id: string
  readonly case_revision: string
  readonly rubric_revision: string
  readonly state:
    | 'issued'
    | 'main_locked'
    | 'decision_complete'
    | 'debrief_complete'
  readonly sequence: number
  readonly assisted: number
  readonly grace_end_at: string
  readonly main_answer_json: string
  readonly followup_json: string
  readonly rubric_json: string
}

interface IdempotencyReceiptRecord {
  readonly request_hash: string
  readonly response_snapshot_json: string
}

const followupCommitSnapshotSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        attempt: z
          .object({
            attempt_id: z.string().regex(attemptPattern),
            state: z.literal('decision_complete'),
            sequence: z.literal(2),
            followup_committed_at: z.iso.datetime(),
          })
          .strict(),
        main_answer: mainAnswerSchema,
        followup_answer: followupAnswerSchema,
        result: publicResultSchema,
        reveal: publicRevealSchema,
      })
      .strict(),
    error: z.null(),
    meta: z
      .object({
        request_id: z.uuid(),
        api_version: z.literal('v1'),
      })
      .strict(),
  })
  .strict()

async function parseFollowupCommitBody(
  request: Request,
): Promise<FollowupAnswer | null> {
  try {
    const text = await request.text()
    if (text.length > maximumStateChangingBodyBytes) return null

    const parsed = followupAnswerSchema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function parseMainAnswer(payloadJson: string): MainAnswer | null {
  try {
    return mainAnswerSchema.parse(JSON.parse(payloadJson))
  } catch {
    return null
  }
}

function parseFollowup(payloadJson: string): PublicFollowup | null {
  try {
    return publicFollowupSchema.parse(JSON.parse(payloadJson))
  } catch {
    return null
  }
}

function parseRubric(payloadJson: string): ServerRubric | null {
  try {
    return serverRubricSchema.parse(JSON.parse(payloadJson))
  } catch {
    return null
  }
}

async function loadOwnedAttempt(
  database: D1Database,
  identityId: string,
  attemptId: string,
): Promise<FollowupCommitProjectionRecord | null> {
  return database
    .prepare(
      `SELECT
         a.attempt_id,
         a.identity_id,
         a.edition_id,
         a.case_revision,
         a.rubric_revision,
         a.state,
         a.sequence,
         a.assisted,
         a.grace_end_at,
         mc.answer_json AS main_answer_json,
         f.payload_json AS followup_json,
         r.payload_json AS rubric_json
       FROM attempts a
       INNER JOIN editions e ON e.edition_id = a.edition_id
       INNER JOIN attempt_commits mc
         ON mc.attempt_id = a.attempt_id AND mc.phase = 'main'
       INNER JOIN case_followups f ON f.case_revision = a.case_revision
       INNER JOIN case_rubrics r ON r.rubric_revision = a.rubric_revision
       WHERE a.attempt_id = ?
         AND a.identity_id = ?
         AND a.mode = 'official'
         AND a.deleted_at IS NULL
         AND e.publication_status = 'released'
       LIMIT 1`,
    )
    .bind(attemptId, identityId)
    .first<FollowupCommitProjectionRecord>()
}

async function loadReceipt(
  database: D1Database,
  attemptId: string,
  idempotencyKey: string,
): Promise<IdempotencyReceiptRecord | null> {
  return database
    .prepare(
      `SELECT request_hash, response_snapshot_json
       FROM idempotency_receipts
       WHERE attempt_id = ? AND phase = 'followup' AND idempotency_key = ?
       LIMIT 1`,
    )
    .bind(attemptId, idempotencyKey)
    .first<IdempotencyReceiptRecord>()
}

function storedResponse(
  receipt: IdempotencyReceiptRecord,
  logContext: LogContext,
): Response | null {
  try {
    followupCommitSnapshotSchema.parse(
      JSON.parse(receipt.response_snapshot_json),
    )

    return new Response(receipt.response_snapshot_json, {
      status: 200,
      headers: { 'content-type': 'application/json', etag: '"2"' },
    })
  } catch {
    logEvent('error', 'content_unavailable', {
      ...logContext,
      payload: 'idempotency_receipt',
    })

    return null
  }
}

function serviceUnavailable(requestId: string) {
  return jsonError(
    503,
    'SERVICE_UNAVAILABLE',
    'The service is temporarily unavailable.',
    requestId,
  )
}

export async function commitFollowupAnswer(
  request: Request,
  env: Bindings,
  requestId: string,
  attemptId: string,
): Promise<Response> {
  if (!env.DB || !env.IDENTITY_PEPPER) return serviceUnavailable(requestId)

  const identity = await authenticateIdentity(request, env)
  if (!identity) {
    return jsonError(401, 'SESSION_INVALID', 'The session is unavailable.', requestId)
  }
  if (!attemptPattern.test(attemptId)) {
    return jsonError(404, 'ATTEMPT_NOT_FOUND', 'The attempt is unavailable.', requestId)
  }
  if (
    !acceptsStateChangingHeaders(request) ||
    !(await verifyCsrfToken(request, env, identity))
  ) {
    return jsonError(403, 'REQUEST_FORBIDDEN', 'The request was not accepted.', requestId)
  }

  const idempotencyKey = request.headers.get('idempotency-key') ?? ''
  const ifMatch = request.headers.get('if-match') ?? ''
  const body = await parseFollowupCommitBody(request)

  if (!idempotencyKeyPattern.test(idempotencyKey) || !body) {
    return jsonError(422, 'VALIDATION_ERROR', 'The submitted data is invalid.', requestId)
  }

  const logContext = requestLogContext(request, requestId)
  const requestHash = await sha256Base64Url(JSON.stringify(body))
  const record = await loadOwnedAttempt(env.DB, identity.identityId, attemptId)
  if (!record) {
    return jsonError(404, 'ATTEMPT_NOT_FOUND', 'The attempt is unavailable.', requestId)
  }

  const existingReceipt = await loadReceipt(env.DB, attemptId, idempotencyKey)
  if (existingReceipt) {
    if (existingReceipt.request_hash !== requestHash) {
      logEvent('warn', 'idempotency_key_reused', {
        ...logContext,
        phase: 'followup',
      })

      return jsonError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'The submission key has already been used.',
        requestId,
      )
    }

    return storedResponse(existingReceipt, logContext) ?? serviceUnavailable(requestId)
  }

  if (record.grace_end_at <= new Date().toISOString()) {
    return jsonError(410, 'ATTEMPT_EXPIRED', 'The attempt is no longer active.', requestId)
  }
  if (record.state !== 'main_locked') {
    logEvent('warn', 'attempt_state_conflict', {
      ...logContext,
      phase: 'followup',
      state: record.state,
    })

    return jsonError(
      409,
      'ATTEMPT_STATE_CONFLICT',
      'The attempt already has an accepted follow-up.',
      requestId,
    )
  }
  if (ifMatch !== `"${record.sequence}"`) {
    logEvent('info', 'attempt_version_conflict', {
      ...logContext,
      phase: 'followup',
    })

    return jsonError(
      409,
      'VERSION_CONFLICT',
      'The attempt has changed. Resume it before trying again.',
      requestId,
    )
  }

  const mainAnswer = parseMainAnswer(record.main_answer_json)
  const followup = parseFollowup(record.followup_json)
  const rubric = parseRubric(record.rubric_json)
  if (!mainAnswer || !followup || !rubric) {
    logEvent('error', 'content_unavailable', {
      ...logContext,
      edition_id: record.edition_id,
      payload: !mainAnswer
        ? 'main_answer'
        : !followup
          ? 'public_followup'
          : 'rubric',
    })

    return serviceUnavailable(requestId)
  }

  if (body.case_revision !== record.case_revision) {
    return jsonError(
      409,
      'VERSION_CONFLICT',
      'The attempt has changed. Resume it before trying again.',
      requestId,
    )
  }
  if (
    rubric.caseRevision !== record.case_revision ||
    rubric.rubricRevision !== record.rubric_revision
  ) {
    logEvent('error', 'content_unavailable', {
      ...logContext,
      edition_id: record.edition_id,
      payload: 'rubric',
      reason: 'revision_mismatch',
    })

    return serviceUnavailable(requestId)
  }
  if (!isPublishedFollowupAnswer(body, followup)) {
    return jsonError(422, 'VALIDATION_ERROR', 'The submitted data is invalid.', requestId)
  }

  const scoringInput = scoringInputFor(rubric, mainAnswer, body)
  if (!scoringInput) {
    logEvent('error', 'followup_commit_rubric_rejected', {
      ...logContext,
      edition_id: record.edition_id,
      payload: 'rubric',
      reason: 'not_covered',
    })

    return jsonError(422, 'VALIDATION_ERROR', 'The submitted data is invalid.', requestId)
  }

  const score = scoreDecision(scoringInput)
  const acceptedAt = new Date().toISOString()
  const resultVersionId = crypto.randomUUID()
  const responseWithoutReveal = {
    ok: true,
    data: {
      attempt: {
        attempt_id: attemptId,
        state: 'decision_complete',
        sequence: 2,
        followup_committed_at: acceptedAt,
      },
      main_answer: mainAnswer,
      followup_answer: body,
      result: {
        version: 1,
        total: score.total,
        components: score.components,
        main_band: scoringInput.mainSharedConsensus
          ? 'Equally strong'
          : outcomeBand(score.qualityQuarterUnits / 4),
        followup_band: scoringInput.followupSharedConsensus
          ? 'Equally strong'
          : outcomeBand(scoringInput.followupQuality),
        confidence_id: mainAnswer.confidence_id,
        mode: 'official',
        assisted: record.assisted === 1,
        participation: 'awarded',
      },
      reveal: null,
    },
    error: null,
    meta: apiMeta(requestId),
  } as const

  try {
    const results = await env.DB.batch([
      env.DB
        .prepare(
          `UPDATE attempts
           SET state = 'decision_complete', sequence = sequence + 1,
               followup_committed_at = ?
           WHERE attempt_id = ?
             AND identity_id = ?
             AND state = 'main_locked'
             AND sequence = ?
             AND deleted_at IS NULL`,
        )
        .bind(acceptedAt, attemptId, identity.identityId, record.sequence),
      env.DB
        .prepare(
          `INSERT INTO attempt_commits (
             attempt_id, phase, answer_json, request_hash,
             expected_sequence, accepted_sequence, accepted_at
           ) VALUES (?, 'followup', ?, ?, ?, 2, ?)`,
        )
        .bind(
          attemptId,
          JSON.stringify(body),
          requestHash,
          record.sequence,
          acceptedAt,
        ),
      env.DB
        .prepare(
          `INSERT INTO result_versions (
             result_version_id, attempt_id, version, status,
             quality_quarter_units, evidence_points, followup_quality,
             exact_total_units, total_score, display_main, display_evidence,
             display_followup, created_at
           ) VALUES (?, ?, 1, 'scored', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          resultVersionId,
          attemptId,
          score.qualityQuarterUnits,
          scoringInput.evidencePoints,
          scoringInput.followupQuality,
          score.exactTotalUnits,
          score.total,
          score.components.main,
          score.components.evidence,
          score.components.followup,
          acceptedAt,
        ),
      env.DB
        .prepare(
          `INSERT INTO participation_credits (
             identity_id, edition_id, attempt_id, awarded_at, status
           ) VALUES (?, ?, ?, ?, 'awarded')`,
        )
        .bind(identity.identityId, record.edition_id, attemptId, acceptedAt),
      env.DB
        .prepare(
          `INSERT INTO idempotency_receipts (
             attempt_id, phase, idempotency_key, request_hash,
             accepted_sequence, accepted_state, response_snapshot_json, created_at
           ) VALUES (
             ?, 'followup', ?, ?, 2, 'decision_complete',
             CASE
               WHEN (SELECT payload_json FROM case_reveals WHERE case_revision = ?) IS NULL
                 THEN NULL
               ELSE json_set(
                 ?, '$.data.reveal',
                 json((SELECT payload_json FROM case_reveals WHERE case_revision = ?))
               )
             END,
             ?
           )`,
        )
        .bind(
          attemptId,
          idempotencyKey,
          requestHash,
          record.case_revision,
          JSON.stringify(responseWithoutReveal),
          record.case_revision,
          acceptedAt,
        ),
    ])

    if (results[0]?.meta.changes !== 1) {
      throw new Error('Follow-up commitment lost the conditional update')
    }
  } catch (error) {
    logEvent('error', 'followup_commit_batch_failed', {
      ...logContext,
      ...errorLogFields(error),
    })

    const winningReceipt = await loadReceipt(env.DB, attemptId, idempotencyKey)
    if (winningReceipt?.request_hash === requestHash) {
      return storedResponse(winningReceipt, logContext) ?? serviceUnavailable(requestId)
    }
    if (winningReceipt) {
      logEvent('warn', 'idempotency_key_reused', {
        ...logContext,
        phase: 'followup',
      })

      return jsonError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'The submission key has already been used.',
        requestId,
      )
    }

    logEvent('warn', 'attempt_state_conflict', {
      ...logContext,
      phase: 'followup',
      reason: 'batch_rejected',
    })

    return jsonError(
      409,
      'ATTEMPT_STATE_CONFLICT',
      'The attempt already has an accepted follow-up.',
      requestId,
    )
  }

  const receipt = await loadReceipt(env.DB, attemptId, idempotencyKey)
  if (!receipt) {
    logEvent('error', 'content_unavailable', {
      ...logContext,
      edition_id: record.edition_id,
      payload: 'idempotency_receipt',
      reason: 'missing_after_commit',
    })
  }

  return receipt
    ? storedResponse(receipt, logContext) ?? serviceUnavailable(requestId)
    : serviceUnavailable(requestId)
}
