import { publicBriefSchema, type PublicBrief } from '../domain/public-brief'
import type { Bindings } from './bindings'
import {
  authenticateIdentity,
  verifyCsrfToken,
} from './identity'
import { encodeBase64Url, jsonError, jsonSuccess } from './http'
import {
  acceptsStateChangingHeaders,
  maximumStateChangingBodyBytes,
} from './request-protection'

const editionPattern = /^[a-z0-9_]{1,80}$/

interface EditionRecord {
  readonly edition_id: string
  readonly case_revision: string
  readonly grace_end_at: string
  readonly rubric_revision: string
  readonly payload_json: string
}

function createAttemptId(): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

function parseBrief(payloadJson: string): PublicBrief | null {
  try {
    return publicBriefSchema.parse(JSON.parse(payloadJson))
  } catch {
    return null
  }
}

export async function createPracticeAttempt(
  request: Request,
  env: Bindings,
  requestId: string,
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

  let editionId: string
  try {
    const text = await request.text()
    if (text.length > maximumStateChangingBodyBytes) {
      return jsonError(
        422,
        'VALIDATION_ERROR',
        'The submitted data is invalid.',
        requestId,
      )
    }
    const value = JSON.parse(text) as unknown
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      Object.keys(value).length !== 1 ||
      !('edition_id' in value) ||
      typeof value.edition_id !== 'string' ||
      !editionPattern.test(value.edition_id)
    ) {
      return jsonError(
        422,
        'VALIDATION_ERROR',
        'The submitted data is invalid.',
        requestId,
      )
    }
    editionId = value.edition_id
  } catch {
    return jsonError(
      422,
      'VALIDATION_ERROR',
      'The submitted data is invalid.',
      requestId,
    )
  }

  const now = new Date().toISOString()

  const edition = await env.DB.prepare(
    `SELECT
       e.edition_id,
       e.case_revision,
       e.grace_end_at,
       r.rubric_revision,
       b.payload_json
     FROM editions e
     INNER JOIN case_revisions cr ON cr.case_revision = e.case_revision
     INNER JOIN case_public_briefs b ON b.case_revision = e.case_revision
     INNER JOIN case_rubrics r ON r.case_revision = e.case_revision
     WHERE e.edition_id = ?
       AND e.publication_status = 'released'
       AND cr.status = 'locked'
       AND e.release_at <= ?
     LIMIT 1`,
  )
    .bind(editionId, now)
    .first<EditionRecord>()

  if (!edition) {
    return jsonError(
      404,
      'NO_CURRENT_EDITION',
      'No current edition is available.',
      requestId,
    )
  }

  const brief = parseBrief(edition.payload_json)
  if (!brief) {
    return jsonError(
      503,
      'SERVICE_UNAVAILABLE',
      'The service is temporarily unavailable.',
      requestId,
    )
  }

  const attemptId = createAttemptId()

  await env.DB.prepare(
    `INSERT INTO attempts (
       attempt_id, identity_id, edition_id, case_revision, rubric_revision,
       ruleset_revision, mode, state, sequence, assisted, issued_at, grace_end_at
     ) VALUES (?, ?, ?, ?, ?, 'ruleset_v1', 'practice', 'issued', 0, 0, ?, ?)`,
  )
    .bind(
      attemptId,
      identity.identityId,
      edition.edition_id,
      edition.case_revision,
      edition.rubric_revision,
      now,
      edition.grace_end_at,
    )
    .run()

  return jsonSuccess(
    {
      attempt: {
        attempt_id: attemptId,
        edition_id: edition.edition_id,
        mode: 'practice' as const,
        state: 'issued' as const,
        sequence: 0,
        assisted: false,
        issued_at: now,
        grace_end_at: edition.grace_end_at,
      },
      brief,
    },
    requestId,
  )
}
