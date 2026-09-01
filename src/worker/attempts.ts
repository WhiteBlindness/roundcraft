import { publicBriefSchema, type PublicBrief } from '../domain/public-brief'
import type { Bindings } from './bindings'
import {
  authenticateIdentity,
  type AuthenticatedIdentity,
  verifyCsrfToken,
} from './identity'
import { encodeBase64Url, jsonError, jsonSuccess } from './http'

const maximumBodyBytes = 1024
const editionPattern = /^[a-z0-9_]{1,80}$/
const attemptPattern = /^[A-Za-z0-9_-]{43}$/

interface EditionProjectionRecord {
  readonly edition_id: string
  readonly case_revision: string
  readonly grace_end_at: string
  readonly payload_json: string
  readonly rubric_revision: string
}

interface AttemptProjectionRecord extends EditionProjectionRecord {
  readonly attempt_id: string
  readonly mode: 'official'
  readonly state: 'issued'
  readonly sequence: number
  readonly assisted: number
  readonly issued_at: string
}

interface AttemptBody {
  readonly edition_id: string
}

function createAttemptId(): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

function acceptsStateChangingHeaders(request: Request): boolean {
  const url = new URL(request.url)
  const contentType = request.headers.get('content-type') ?? ''
  const contentLength = Number(request.headers.get('content-length') ?? 0)

  return (
    request.headers.get('origin') === url.origin &&
    request.headers.get('sec-fetch-site') === 'same-origin' &&
    contentType.toLowerCase().startsWith('application/json') &&
    Number.isFinite(contentLength) &&
    contentLength <= maximumBodyBytes
  )
}

async function parseAttemptBody(request: Request): Promise<AttemptBody | null> {
  try {
    const text = await request.text()
    const value = JSON.parse(text) as unknown

    if (
      text.length > maximumBodyBytes ||
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      Object.keys(value).length !== 1 ||
      !('edition_id' in value) ||
      typeof value.edition_id !== 'string' ||
      !editionPattern.test(value.edition_id)
    ) {
      return null
    }

    return { edition_id: value.edition_id }
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

function publicAttempt(record: AttemptProjectionRecord) {
  return {
    attempt_id: record.attempt_id,
    edition_id: record.edition_id,
    mode: record.mode,
    state: record.state,
    sequence: record.sequence,
    assisted: record.assisted === 1,
    issued_at: record.issued_at,
    grace_end_at: record.grace_end_at,
  } as const
}

async function loadEdition(
  database: D1Database,
  editionId: string,
  now: string,
): Promise<EditionProjectionRecord | null> {
  return database
    .prepare(
      `SELECT
         e.edition_id,
         e.case_revision,
         e.grace_end_at,
         b.payload_json,
         r.rubric_revision
       FROM editions e
       INNER JOIN case_revisions cr ON cr.case_revision = e.case_revision
       INNER JOIN case_public_briefs b ON b.case_revision = e.case_revision
       INNER JOIN case_rubrics r ON r.case_revision = e.case_revision
       WHERE e.edition_id = ?
         AND e.publication_status = 'released'
         AND cr.status = 'locked'
         AND e.release_at <= ?
         AND e.official_end_at > ?
       LIMIT 1`,
    )
    .bind(editionId, now, now)
    .first<EditionProjectionRecord>()
}

async function loadOwnedAttempt(
  database: D1Database,
  identityId: string,
  attemptId: string,
): Promise<AttemptProjectionRecord | null> {
  return database
    .prepare(
      `SELECT
         a.attempt_id,
         a.edition_id,
         a.mode,
         a.state,
         a.sequence,
         a.assisted,
         a.issued_at,
         a.grace_end_at,
         a.case_revision,
         b.payload_json,
         a.rubric_revision
       FROM attempts a
       INNER JOIN editions e ON e.edition_id = a.edition_id
       INNER JOIN case_public_briefs b ON b.case_revision = a.case_revision
       WHERE a.attempt_id = ?
         AND a.identity_id = ?
         AND a.mode = 'official'
         AND a.deleted_at IS NULL
         AND e.publication_status = 'released'
       LIMIT 1`,
    )
    .bind(attemptId, identityId)
    .first<AttemptProjectionRecord>()
}

async function loadOwnedAttemptForEdition(
  database: D1Database,
  identityId: string,
  editionId: string,
): Promise<AttemptProjectionRecord | null> {
  return database
    .prepare(
      `SELECT
         a.attempt_id,
         a.edition_id,
         a.mode,
         a.state,
         a.sequence,
         a.assisted,
         a.issued_at,
         a.grace_end_at,
         a.case_revision,
         b.payload_json,
         a.rubric_revision
       FROM attempts a
       INNER JOIN editions e ON e.edition_id = a.edition_id
       INNER JOIN case_public_briefs b ON b.case_revision = a.case_revision
       WHERE a.identity_id = ?
         AND a.edition_id = ?
         AND a.mode = 'official'
         AND a.deleted_at IS NULL
         AND e.publication_status = 'released'
       LIMIT 1`,
    )
    .bind(identityId, editionId)
    .first<AttemptProjectionRecord>()
}

async function issueOrLoadAttempt(
  database: D1Database,
  identity: AuthenticatedIdentity,
  edition: EditionProjectionRecord,
  now: string,
): Promise<AttemptProjectionRecord | null> {
  await database
    .prepare(
      `INSERT OR IGNORE INTO attempts (
         attempt_id, identity_id, edition_id, case_revision, rubric_revision,
         ruleset_revision, mode, state, sequence, assisted, issued_at, grace_end_at
       ) VALUES (?, ?, ?, ?, ?, 'ruleset_v1', 'official', 'issued', 0, 0, ?, ?)`,
    )
    .bind(
      createAttemptId(),
      identity.identityId,
      edition.edition_id,
      edition.case_revision,
      edition.rubric_revision,
      now,
      edition.grace_end_at,
    )
    .run()

  return database
    .prepare(
      `SELECT
         a.attempt_id,
         a.edition_id,
         a.mode,
         a.state,
         a.sequence,
         a.assisted,
         a.issued_at,
         a.grace_end_at,
         a.case_revision,
         b.payload_json,
         a.rubric_revision
       FROM attempts a
       INNER JOIN case_public_briefs b ON b.case_revision = a.case_revision
       WHERE a.identity_id = ? AND a.edition_id = ? AND a.mode = 'official'
       LIMIT 1`,
    )
    .bind(identity.identityId, edition.edition_id)
    .first<AttemptProjectionRecord>()
}

export async function createOrResumeAttempt(
  request: Request,
  env: Bindings,
  requestId: string,
): Promise<Response> {
  if (!env.DB || !env.IDENTITY_PEPPER) {
    return jsonError(503, 'SERVICE_UNAVAILABLE', 'The service is temporarily unavailable.', requestId)
  }

  const identity = await authenticateIdentity(request, env)
  if (!identity) {
    return jsonError(401, 'SESSION_INVALID', 'The session is unavailable.', requestId)
  }

  if (
    !acceptsStateChangingHeaders(request) ||
    !(await verifyCsrfToken(request, env, identity))
  ) {
    return jsonError(403, 'REQUEST_FORBIDDEN', 'The request was not accepted.', requestId)
  }

  const body = await parseAttemptBody(request)
  if (!body) {
    return jsonError(422, 'VALIDATION_ERROR', 'The submitted data is invalid.', requestId)
  }

  const now = new Date().toISOString()
  const existing = await loadOwnedAttemptForEdition(
    env.DB,
    identity.identityId,
    body.edition_id,
  )

  if (existing) {
    if (existing.grace_end_at <= now) {
      return jsonError(
        410,
        'ATTEMPT_EXPIRED',
        'The attempt is no longer active.',
        requestId,
      )
    }

    const existingBrief = parseBrief(existing.payload_json)
    if (!existingBrief) {
      return jsonError(
        503,
        'SERVICE_UNAVAILABLE',
        'The service is temporarily unavailable.',
        requestId,
      )
    }

    return jsonSuccess(
      { attempt: publicAttempt(existing), brief: existingBrief },
      requestId,
    )
  }

  const edition = await loadEdition(env.DB, body.edition_id, now)
  if (!edition) {
    return jsonError(404, 'NO_CURRENT_EDITION', 'No current edition is available.', requestId)
  }

  const record = await issueOrLoadAttempt(env.DB, identity, edition, now)
  const brief = record ? parseBrief(record.payload_json) : null
  if (!record || !brief) {
    return jsonError(503, 'SERVICE_UNAVAILABLE', 'The service is temporarily unavailable.', requestId)
  }

  return jsonSuccess({ attempt: publicAttempt(record), brief }, requestId)
}

export async function getAttempt(
  request: Request,
  env: Bindings,
  requestId: string,
  attemptId: string,
): Promise<Response> {
  if (!env.DB || !env.IDENTITY_PEPPER) {
    return jsonError(503, 'SERVICE_UNAVAILABLE', 'The service is temporarily unavailable.', requestId)
  }

  const identity = await authenticateIdentity(request, env)
  if (!identity) {
    return jsonError(401, 'SESSION_INVALID', 'The session is unavailable.', requestId)
  }

  if (!attemptPattern.test(attemptId)) {
    return jsonError(404, 'ATTEMPT_NOT_FOUND', 'The attempt is unavailable.', requestId)
  }

  const record = await loadOwnedAttempt(env.DB, identity.identityId, attemptId)
  if (!record) {
    return jsonError(404, 'ATTEMPT_NOT_FOUND', 'The attempt is unavailable.', requestId)
  }

  if (record.grace_end_at <= new Date().toISOString()) {
    return jsonError(410, 'ATTEMPT_EXPIRED', 'The attempt is no longer active.', requestId)
  }

  const brief = parseBrief(record.payload_json)
  if (!brief) {
    return jsonError(503, 'SERVICE_UNAVAILABLE', 'The service is temporarily unavailable.', requestId)
  }

  return jsonSuccess({ attempt: publicAttempt(record), brief }, requestId)
}
