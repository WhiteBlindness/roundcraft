import type { Bindings } from './bindings'
import { authenticateIdentity, verifyCsrfToken } from './identity'
import { jsonError, jsonSuccess } from './http'
import { logEvent, requestLogContext } from './log'
import {
  acceptsStateChangingHeaders,
  maximumStateChangingBodyBytes,
} from './request-protection'

const attemptPattern = /^[A-Za-z0-9_-]{43}$/

interface CompletionRecord {
  readonly attempt_id: string
  readonly state:
    | 'issued'
    | 'main_locked'
    | 'decision_complete'
    | 'debrief_complete'
  readonly sequence: number
  readonly debrief_completed_at: string | null
}

async function hasEmptyBody(request: Request): Promise<boolean> {
  try {
    const text = await request.text()
    if (text.length > maximumStateChangingBodyBytes) return false

    const value = JSON.parse(text) as unknown
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0
    )
  } catch {
    return false
  }
}

async function loadOwnedAttempt(
  database: D1Database,
  identityId: string,
  attemptId: string,
): Promise<CompletionRecord | null> {
  return database
    .prepare(
      `SELECT
         a.attempt_id,
         a.state,
         a.sequence,
         a.debrief_completed_at
       FROM attempts a
       INNER JOIN editions e ON e.edition_id = a.edition_id
       WHERE a.attempt_id = ?
         AND a.identity_id = ?
         AND a.mode = 'official'
         AND a.deleted_at IS NULL
         AND e.publication_status = 'released'
       LIMIT 1`,
    )
    .bind(attemptId, identityId)
    .first<CompletionRecord>()
}

function completedResponse(record: CompletionRecord, requestId: string) {
  if (
    record.state !== 'debrief_complete' ||
    record.sequence !== 3 ||
    !record.debrief_completed_at
  ) {
    return null
  }

  return jsonSuccess(
    {
      attempt: {
        attempt_id: record.attempt_id,
        state: record.state,
        sequence: record.sequence,
        debrief_completed_at: record.debrief_completed_at,
      },
    },
    requestId,
    { headers: { etag: '"3"' } },
  )
}

export async function completeDebrief(
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
  if (!(await hasEmptyBody(request))) {
    return jsonError(
      422,
      'VALIDATION_ERROR',
      'The submitted data is invalid.',
      requestId,
    )
  }

  const record = await loadOwnedAttempt(env.DB, identity.identityId, attemptId)
  if (!record) {
    return jsonError(
      404,
      'ATTEMPT_NOT_FOUND',
      'The attempt is unavailable.',
      requestId,
    )
  }
  if (request.headers.get('if-match') !== '"2"') {
    return jsonError(
      409,
      'VERSION_CONFLICT',
      'The attempt has changed. Resume it before trying again.',
      requestId,
    )
  }

  const existingResponse = completedResponse(record, requestId)
  if (existingResponse) return existingResponse

  if (record.state !== 'decision_complete' || record.sequence !== 2) {
    logEvent('warn', 'attempt_state_conflict', {
      ...requestLogContext(request, requestId),
      phase: 'debrief',
      state: record.state,
    })

    return jsonError(
      409,
      'ATTEMPT_STATE_CONFLICT',
      'The review cannot be completed from its current state.',
      requestId,
    )
  }

  const completedAt = new Date().toISOString()
  const result = await env.DB
    .prepare(
      `UPDATE attempts
       SET state = 'debrief_complete',
           sequence = sequence + 1,
           debrief_completed_at = ?
       WHERE attempt_id = ?
         AND identity_id = ?
         AND state = 'decision_complete'
         AND sequence = 2
         AND deleted_at IS NULL`,
    )
    .bind(completedAt, attemptId, identity.identityId)
    .run()

  if (result.meta.changes === 1) {
    return completedResponse(
      {
        ...record,
        state: 'debrief_complete',
        sequence: 3,
        debrief_completed_at: completedAt,
      },
      requestId,
    ) as Response
  }

  const winner = await loadOwnedAttempt(env.DB, identity.identityId, attemptId)
  const winnerResponse = winner ? completedResponse(winner, requestId) : null
  if (winnerResponse) return winnerResponse

  logEvent('warn', 'attempt_state_conflict', {
    ...requestLogContext(request, requestId),
    phase: 'debrief',
    reason: 'update_lost',
  })

  return jsonError(
    409,
    'ATTEMPT_STATE_CONFLICT',
    'The review cannot be completed from its current state.',
    requestId,
  )
}
