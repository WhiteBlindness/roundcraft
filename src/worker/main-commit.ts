import {
  isPublishedMainAnswer,
  mainCommitBodySchema,
  type MainAnswer,
  type MainCommitBody,
} from '../domain/main-answer'
import { publicBriefSchema, type PublicBrief } from '../domain/public-brief'
import {
  publicFollowupSchema,
  type PublicFollowup,
} from '../domain/public-followup'
import {
  rubricCoversMainAnswer,
  serverRubricSchema,
  type ServerRubric,
} from '../domain/server-rubric'
import type { Bindings } from './bindings'
import { authenticateIdentity, verifyCsrfToken } from './identity'
import { apiMeta, jsonError, sha256Base64Url } from './http'
import { errorLogFields, logEvent, requestLogContext } from './log'
import {
  acceptsStateChangingHeaders,
  maximumStateChangingBodyBytes,
} from './request-protection'

const attemptPattern = /^[A-Za-z0-9_-]{43}$/
const idempotencyKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface MainCommitProjectionRecord {
  readonly attempt_id: string
  readonly edition_id: string
  readonly case_revision: string
  readonly rubric_revision: string
  readonly state:
    | 'issued'
    | 'main_locked'
    | 'decision_complete'
    | 'debrief_complete'
  readonly sequence: number
  readonly grace_end_at: string
  readonly payload_json: string
  readonly followup_json: string
  /** Server-only. Parsed to check scoring coverage; never serialised. */
  readonly rubric_json: string | null
}

interface IdempotencyReceiptRecord {
  readonly request_hash: string
  readonly response_snapshot_json: string
}

async function parseMainCommitBody(
  request: Request,
): Promise<MainCommitBody | null> {
  try {
    const text = await request.text()
    if (text.length > maximumStateChangingBodyBytes) return null

    const result = mainCommitBodySchema.safeParse(JSON.parse(text))

    return result.success ? result.data : null
  } catch {
    return null
  }
}

function parseBrief(payloadJson: string): PublicBrief | null {
  try {
    return publicBriefSchema.parse(JSON.parse(payloadJson))
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

type RubricProblem = 'missing' | 'invalid' | 'revision_mismatch' | 'not_covered'

function rubricProblemFor(
  record: MainCommitProjectionRecord,
  mainAnswer: MainAnswer,
  followup: PublicFollowup,
): RubricProblem | null {
  if (!record.rubric_json) return 'missing'

  const rubric = parseRubric(record.rubric_json)
  if (!rubric) return 'invalid'

  if (
    rubric.caseRevision !== record.case_revision ||
    rubric.rubricRevision !== record.rubric_revision
  ) {
    return 'revision_mismatch'
  }

  return rubricCoversMainAnswer(rubric, mainAnswer, followup) ? null : 'not_covered'
}

async function loadOwnedAttempt(
  database: D1Database,
  identityId: string,
  attemptId: string,
): Promise<MainCommitProjectionRecord | null> {
  return database
    .prepare(
      `SELECT
         a.attempt_id,
         a.edition_id,
         a.case_revision,
         a.rubric_revision,
         a.state,
         a.sequence,
         a.grace_end_at,
         b.payload_json,
         f.payload_json AS followup_json,
         r.payload_json AS rubric_json
       FROM attempts a
       INNER JOIN editions e ON e.edition_id = a.edition_id
       INNER JOIN case_public_briefs b ON b.case_revision = a.case_revision
       INNER JOIN case_followups f ON f.case_revision = a.case_revision
       LEFT JOIN case_rubrics r ON r.rubric_revision = a.rubric_revision
       WHERE a.attempt_id = ?
         AND a.identity_id = ?
         AND a.mode = 'official'
         AND a.deleted_at IS NULL
         AND e.publication_status = 'released'
       LIMIT 1`,
    )
    .bind(attemptId, identityId)
    .first<MainCommitProjectionRecord>()
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
       WHERE attempt_id = ? AND phase = 'main' AND idempotency_key = ?
       LIMIT 1`,
    )
    .bind(attemptId, idempotencyKey)
    .first<IdempotencyReceiptRecord>()
}

function storedResponse(receipt: IdempotencyReceiptRecord): Response {
  return new Response(receipt.response_snapshot_json, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      etag: '"1"',
    },
  })
}

export async function commitMainAnswer(
  request: Request,
  env: Bindings,
  requestId: string,
  attemptId: string,
): Promise<Response> {
  if (!env.DB || !env.IDENTITY_PEPPER) {
    return jsonError(
      503,
      'SERVICE_UNAVAILABLE',
      'The service is temporarily unavailable.',
      requestId,
    )
  }

  const identity = await authenticateIdentity(request, env)
  if (!identity) {
    return jsonError(
      401,
      'SESSION_INVALID',
      'The session is unavailable.',
      requestId,
    )
  }

  if (!attemptPattern.test(attemptId)) {
    return jsonError(
      404,
      'ATTEMPT_NOT_FOUND',
      'The attempt is unavailable.',
      requestId,
    )
  }

  if (
    !acceptsStateChangingHeaders(request) ||
    !(await verifyCsrfToken(request, env, identity))
  ) {
    return jsonError(
      403,
      'REQUEST_FORBIDDEN',
      'The request was not accepted.',
      requestId,
    )
  }

  const idempotencyKey = request.headers.get('idempotency-key') ?? ''
  const ifMatch = request.headers.get('if-match') ?? ''
  const body = await parseMainCommitBody(request)

  if (!idempotencyKeyPattern.test(idempotencyKey) || !body) {
    return jsonError(
      422,
      'VALIDATION_ERROR',
      'The submitted data is invalid.',
      requestId,
    )
  }

  const logContext = requestLogContext(request, requestId)
  const requestHash = await sha256Base64Url(JSON.stringify(body))
  const record = await loadOwnedAttempt(env.DB, identity.identityId, attemptId)
  if (!record) {
    return jsonError(
      404,
      'ATTEMPT_NOT_FOUND',
      'The attempt is unavailable.',
      requestId,
    )
  }

  const existingReceipt = await loadReceipt(env.DB, attemptId, idempotencyKey)
  if (existingReceipt) {
    if (existingReceipt.request_hash !== requestHash) {
      logEvent('warn', 'idempotency_key_reused', {
        ...logContext,
        phase: 'main',
      })

      return jsonError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'The submission key has already been used.',
        requestId,
      )
    }

    return storedResponse(existingReceipt)
  }

  if (record.grace_end_at <= new Date().toISOString()) {
    return jsonError(
      410,
      'ATTEMPT_EXPIRED',
      'The attempt is no longer active.',
      requestId,
    )
  }

  if (record.state !== 'issued') {
    logEvent('warn', 'attempt_state_conflict', {
      ...logContext,
      phase: 'main',
      state: record.state,
    })

    return jsonError(
      409,
      'ATTEMPT_STATE_CONFLICT',
      'The attempt already has an accepted main line.',
      requestId,
    )
  }

  if (ifMatch !== `"${record.sequence}"`) {
    logEvent('info', 'attempt_version_conflict', {
      ...logContext,
      phase: 'main',
    })

    return jsonError(
      409,
      'VERSION_CONFLICT',
      'The attempt has changed. Resume it before trying again.',
      requestId,
    )
  }

  const brief = parseBrief(record.payload_json)
  const followup = parseFollowup(record.followup_json)
  if (!brief || !followup) {
    logEvent('error', 'content_unavailable', {
      ...logContext,
      edition_id: record.edition_id,
      payload: brief ? 'public_followup' : 'public_brief',
    })

    return jsonError(
      503,
      'SERVICE_UNAVAILABLE',
      'The service is temporarily unavailable.',
      requestId,
    )
  }

  if (body.case_revision !== brief.caseRevision) {
    return jsonError(
      409,
      'VERSION_CONFLICT',
      'The attempt has changed. Resume it before trying again.',
      requestId,
    )
  }

  if (!isPublishedMainAnswer(body, brief)) {
    return jsonError(
      422,
      'VALIDATION_ERROR',
      'The submitted data is invalid.',
      requestId,
    )
  }

  const mainAnswer = {
    action_id: body.action_id,
    qualifier_id: body.qualifier_id,
    evidence_ids: body.evidence_ids,
    confidence_id: body.confidence_id,
  } as const

  // The main answer is irreversible, so refuse to lock it unless the server
  // rubric can later score it. The rubric is parsed here only to check
  // coverage and is never serialised into any response.
  const rubricProblem = rubricProblemFor(record, mainAnswer, followup)

  if (rubricProblem) {
    logEvent('error', 'main_commit_rubric_rejected', {
      ...logContext,
      edition_id: record.edition_id,
      payload: 'rubric',
      reason: rubricProblem,
    })

    return jsonError(
      503,
      'SERVICE_UNAVAILABLE',
      'The service is temporarily unavailable.',
      requestId,
    )
  }

  const acceptedAt = new Date().toISOString()
  const responseSnapshot = {
    ok: true,
    data: {
      attempt: {
        attempt_id: attemptId,
        state: 'main_locked',
        sequence: record.sequence + 1,
        main_committed_at: acceptedAt,
      },
      main_answer: mainAnswer,
      followup,
    },
    error: null,
    meta: apiMeta(requestId),
  } as const

  try {
    const results = await env.DB.batch([
      env.DB
        .prepare(
          `UPDATE attempts
           SET state = 'main_locked', sequence = sequence + 1, main_committed_at = ?
           WHERE attempt_id = ?
             AND identity_id = ?
             AND state = 'issued'
             AND sequence = ?
             AND deleted_at IS NULL`,
        )
        .bind(acceptedAt, attemptId, identity.identityId, record.sequence),
      env.DB
        .prepare(
          `INSERT INTO attempt_commits (
             attempt_id, phase, answer_json, request_hash,
             expected_sequence, accepted_sequence, accepted_at
           ) VALUES (?, 'main', ?, ?, ?, ?, ?)`,
        )
        .bind(
          attemptId,
          JSON.stringify(mainAnswer),
          requestHash,
          record.sequence,
          record.sequence + 1,
          acceptedAt,
        ),
      env.DB
        .prepare(
          `INSERT INTO idempotency_receipts (
             attempt_id, phase, idempotency_key, request_hash,
             accepted_sequence, accepted_state, response_snapshot_json, created_at
           ) VALUES (?, 'main', ?, ?, ?, 'main_locked', ?, ?)`,
        )
        .bind(
          attemptId,
          idempotencyKey,
          requestHash,
          record.sequence + 1,
          JSON.stringify(responseSnapshot),
          acceptedAt,
        ),
    ])

    if (results[0]?.meta.changes !== 1) {
      throw new Error('Main commitment lost the conditional update')
    }
  } catch (error) {
    logEvent('error', 'main_commit_batch_failed', {
      ...logContext,
      ...errorLogFields(error),
    })

    const winningReceipt = await loadReceipt(env.DB, attemptId, idempotencyKey)

    if (winningReceipt?.request_hash === requestHash) {
      return storedResponse(winningReceipt)
    }

    if (winningReceipt) {
      logEvent('warn', 'idempotency_key_reused', {
        ...logContext,
        phase: 'main',
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
      phase: 'main',
      reason: 'batch_rejected',
    })

    return jsonError(
      409,
      'ATTEMPT_STATE_CONFLICT',
      'The attempt already has an accepted main line.',
      requestId,
    )
  }

  return Response.json(responseSnapshot, {
    headers: { etag: '"1"' },
  })
}
