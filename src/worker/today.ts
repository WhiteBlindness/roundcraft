import type { Bindings } from './bindings'
import { publicMetadataSchema } from './edition-metadata'
import { jsonError, jsonSuccess, sha256Base64Url } from './http'
import { authenticateIdentity } from './identity'
import { logEvent, requestLogContext } from './log'
import { playableRevisionSql } from './playable'

interface CurrentEditionRecord {
  readonly edition_id: string
  readonly origin: 'synthetic' | 'professional'
  readonly public_metadata_json: string
}

function unavailableData() {
  return {
    availability: 'unavailable',
    edition: null,
    status: 'unavailable',
    primary_action: 'retry_later',
  } as const
}

async function publicResponse(
  request: Request,
  data: unknown,
  requestId: string,
): Promise<Response> {
  const etag = `"${await sha256Base64Url(JSON.stringify(data))}"`
  const headers = new Headers({
    // The body varies by session cookie (status, primary_action), so it must
    // never be stored by a shared cache. Revalidation via ETag still works.
    'Cache-Control': 'private, no-cache',
    Vary: 'Cookie',
    ETag: etag,
  })

  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers })
  }

  return jsonSuccess(data, requestId, { headers })
}

export async function getToday(
  request: Request,
  env: Bindings,
  requestId: string,
): Promise<Response> {
  if (!env.DB) {
    return jsonError(
      503,
      'SERVICE_UNAVAILABLE',
      'The service is temporarily unavailable.',
      requestId,
    )
  }

  const now = new Date().toISOString()
  const edition = await env.DB.prepare(
    `SELECT e.edition_id, c.origin, e.public_metadata_json
     FROM editions AS e
     INNER JOIN case_revisions AS cr ON cr.case_revision = e.case_revision
     INNER JOIN cases AS c ON c.case_id = cr.case_id
     WHERE ${playableRevisionSql}
       AND e.release_at <= ?
       AND e.official_end_at > ?
     ORDER BY e.release_at DESC
     LIMIT 1`,
  )
    .bind(now, now)
    .first<CurrentEditionRecord>()

  if (!edition) {
    return publicResponse(request, unavailableData(), requestId)
  }

  let metadata: unknown

  try {
    metadata = JSON.parse(edition.public_metadata_json)
  } catch {
    logEvent('error', 'content_unavailable', {
      ...requestLogContext(request, requestId),
      edition_id: edition.edition_id,
      payload: 'public_metadata',
      reason: 'invalid_json',
    })

    return jsonError(
      503,
      'SERVICE_UNAVAILABLE',
      'The service is temporarily unavailable.',
      requestId,
    )
  }

  const parsedMetadata = publicMetadataSchema.safeParse(metadata)

  if (!parsedMetadata.success) {
    logEvent('error', 'content_unavailable', {
      ...requestLogContext(request, requestId),
      edition_id: edition.edition_id,
      payload: 'public_metadata',
      reason: 'schema_mismatch',
    })

    return jsonError(
      503,
      'SERVICE_UNAVAILABLE',
      'The service is temporarily unavailable.',
      requestId,
    )
  }

  let status: string = 'new'
  let primaryAction: string = 'start_case'

  const identity = await authenticateIdentity(request, env)
  if (identity) {
    const attempt = await env.DB.prepare(
      `SELECT state FROM attempts
       WHERE identity_id = ? AND edition_id = ? AND mode = 'official' AND deleted_at IS NULL
       LIMIT 1`,
    )
      .bind(identity.identityId, edition.edition_id)
      .first<{ readonly state: string }>()

    if (attempt) {
      switch (attempt.state) {
        case 'issued':
        case 'main_locked':
          status = 'in_progress'
          primaryAction = 'continue'
          break
        case 'decision_complete':
          status = 'decision_complete'
          primaryAction = 'view_debrief'
          break
        case 'debrief_complete':
          status = 'complete'
          primaryAction = 'review'
          break
      }
    }
  }

  const data = {
    availability: 'available',
    edition: {
      edition_id: edition.edition_id,
      ...parsedMetadata.data,
      status,
      primary_action: primaryAction,
      origin: edition.origin,
    },
  } as const

  return publicResponse(request, data, requestId)
}
