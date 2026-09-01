import {
  isPublishedMainAnswer,
  mainAnswerSchema,
  type MainCommitBody,
} from '../domain/main-answer'
import { followupAnswerSchema } from '../domain/followup-answer'
import { publicBriefSchema, type PublicBrief } from '../domain/public-brief'
import {
  publicFollowupSchema,
  type PublicFollowup,
} from '../domain/public-followup'
import { publicResultSchema } from '../domain/public-result'
import { publicRevealSchema } from '../domain/public-reveal'
import type { Bindings } from './bindings'
import {
  authenticateIdentity,
  type AuthenticatedIdentity,
  verifyCsrfToken,
} from './identity'
import { encodeBase64Url, jsonError, jsonSuccess } from './http'
import {
  acceptsStateChangingHeaders,
  maximumStateChangingBodyBytes,
} from './request-protection'

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
  readonly state:
    | 'issued'
    | 'main_locked'
    | 'decision_complete'
    | 'debrief_complete'
  readonly sequence: number
  readonly assisted: number
  readonly issued_at: string
  readonly main_committed_at?: string | null
  readonly followup_committed_at?: string | null
  readonly debrief_completed_at?: string | null
  readonly main_answer_json?: string | null
  readonly followup_json?: string | null
}

interface DecisionProjectionRecord {
  readonly followup_answer_json: string
  readonly response_snapshot_json: string
}

interface AttemptBody {
  readonly edition_id: string
}

function createAttemptId(): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

async function parseAttemptBody(request: Request): Promise<AttemptBody | null> {
  try {
    const text = await request.text()
    const value = JSON.parse(text) as unknown

    if (
      text.length > maximumStateChangingBodyBytes ||
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

function parseFollowup(payloadJson: string): PublicFollowup | null {
  try {
    return publicFollowupSchema.parse(JSON.parse(payloadJson))
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
    ...(record.main_committed_at
      ? { main_committed_at: record.main_committed_at }
      : {}),
    ...(record.followup_committed_at
      ? { followup_committed_at: record.followup_committed_at }
      : {}),
    ...(record.debrief_completed_at
      ? { debrief_completed_at: record.debrief_completed_at }
      : {}),
  } as const
}

function parseStoredMainAnswer(
  payloadJson: string | null,
  brief: PublicBrief,
): Omit<MainCommitBody, 'case_revision'> | null {
  if (!payloadJson) return null

  try {
    const parsed = mainAnswerSchema.safeParse(JSON.parse(payloadJson))
    if (!parsed.success) return null

    const body: MainCommitBody = {
      case_revision: brief.caseRevision,
      ...parsed.data,
      evidence_ids: parsed.data.evidence_ids as [string, string],
    }

    return isPublishedMainAnswer(body, brief)
      ? {
          action_id: body.action_id,
          qualifier_id: body.qualifier_id,
          evidence_ids: body.evidence_ids,
          confidence_id: body.confidence_id,
        }
      : null
  } catch {
    return null
  }
}

async function loadDecisionProjection(
  database: D1Database,
  attemptId: string,
): Promise<DecisionProjectionRecord | null> {
  return database
    .prepare(
      `SELECT
         fc.answer_json AS followup_answer_json,
         ir.response_snapshot_json
       FROM attempt_commits fc
       INNER JOIN attempts a ON a.attempt_id = fc.attempt_id
       INNER JOIN result_versions rv ON rv.attempt_id = a.attempt_id
       INNER JOIN participation_credits pc ON pc.attempt_id = a.attempt_id
       INNER JOIN idempotency_receipts ir
         ON ir.attempt_id = a.attempt_id AND ir.phase = 'followup'
       WHERE fc.attempt_id = ?
         AND fc.phase = 'followup'
         AND rv.status = 'scored'
         AND pc.status = 'awarded'
       ORDER BY rv.version DESC
       LIMIT 1`,
    )
    .bind(attemptId)
    .first<DecisionProjectionRecord>()
}

async function authorizedAttemptProjection(
  record: AttemptProjectionRecord,
  database: D1Database,
) {
  const brief = parseBrief(record.payload_json)
  if (!brief) return null

  if (record.state === 'issued') {
    return { attempt: publicAttempt(record), brief } as const
  }

  if (record.state === 'main_locked') {
    const mainAnswer = parseStoredMainAnswer(record.main_answer_json ?? null, brief)
    const followup = record.followup_json
      ? parseFollowup(record.followup_json)
      : null

    if (!mainAnswer || !followup) return null

    return {
      attempt: publicAttempt(record),
      brief,
      main_answer: mainAnswer,
      followup,
    } as const
  }

  if (
    record.state === 'decision_complete' ||
    record.state === 'debrief_complete'
  ) {
    const mainAnswer = parseStoredMainAnswer(record.main_answer_json ?? null, brief)
    const followup = record.followup_json
      ? parseFollowup(record.followup_json)
      : null
    const decision = await loadDecisionProjection(database, record.attempt_id)

    if (!mainAnswer || !followup || !decision) return null

    try {
      const followupAnswer = followupAnswerSchema.parse(
        JSON.parse(decision.followup_answer_json),
      )
      const storedSnapshot = JSON.parse(decision.response_snapshot_json) as {
        readonly data?: { readonly result?: unknown; readonly reveal?: unknown }
      }
      const result = publicResultSchema.parse(storedSnapshot.data?.result)
      const reveal = publicRevealSchema.parse(storedSnapshot.data?.reveal)

      return {
        attempt: publicAttempt(record),
        brief,
        main_answer: mainAnswer,
        followup,
        followup_answer: followupAnswer,
        result,
        reveal,
      } as const
    } catch {
      return null
    }
  }

  return null
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
         a.main_committed_at,
         a.followup_committed_at,
         a.debrief_completed_at,
         a.grace_end_at,
         a.case_revision,
         b.payload_json,
         a.rubric_revision,
         mc.answer_json AS main_answer_json,
         f.payload_json AS followup_json
       FROM attempts a
       INNER JOIN editions e ON e.edition_id = a.edition_id
       INNER JOIN case_public_briefs b ON b.case_revision = a.case_revision
       LEFT JOIN attempt_commits mc
         ON mc.attempt_id = a.attempt_id AND mc.phase = 'main'
       LEFT JOIN case_followups f ON f.case_revision = a.case_revision
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
         a.main_committed_at,
         a.followup_committed_at,
         a.debrief_completed_at,
         a.grace_end_at,
         a.case_revision,
         b.payload_json,
         a.rubric_revision,
         mc.answer_json AS main_answer_json,
         f.payload_json AS followup_json
       FROM attempts a
       INNER JOIN editions e ON e.edition_id = a.edition_id
       INNER JOIN case_public_briefs b ON b.case_revision = a.case_revision
       LEFT JOIN attempt_commits mc
         ON mc.attempt_id = a.attempt_id AND mc.phase = 'main'
       LEFT JOIN case_followups f ON f.case_revision = a.case_revision
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
         a.main_committed_at,
         a.followup_committed_at,
         a.debrief_completed_at,
         a.grace_end_at,
         a.case_revision,
         b.payload_json,
         a.rubric_revision,
         mc.answer_json AS main_answer_json,
         f.payload_json AS followup_json
       FROM attempts a
       INNER JOIN case_public_briefs b ON b.case_revision = a.case_revision
       LEFT JOIN attempt_commits mc
         ON mc.attempt_id = a.attempt_id AND mc.phase = 'main'
       LEFT JOIN case_followups f ON f.case_revision = a.case_revision
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

    const existingProjection = await authorizedAttemptProjection(existing, env.DB)
    if (!existingProjection) {
      return jsonError(
        503,
        'SERVICE_UNAVAILABLE',
        'The service is temporarily unavailable.',
        requestId,
      )
    }

    return jsonSuccess(existingProjection, requestId)
  }

  const edition = await loadEdition(env.DB, body.edition_id, now)
  if (!edition) {
    return jsonError(404, 'NO_CURRENT_EDITION', 'No current edition is available.', requestId)
  }

  const record = await issueOrLoadAttempt(env.DB, identity, edition, now)
  const projection = record
    ? await authorizedAttemptProjection(record, env.DB)
    : null
  if (!projection) {
    return jsonError(503, 'SERVICE_UNAVAILABLE', 'The service is temporarily unavailable.', requestId)
  }

  return jsonSuccess(projection, requestId)
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

  const projection = await authorizedAttemptProjection(record, env.DB)
  if (!projection) {
    return jsonError(503, 'SERVICE_UNAVAILABLE', 'The service is temporarily unavailable.', requestId)
  }

  return jsonSuccess(projection, requestId)
}
