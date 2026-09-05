import type { Bindings } from './bindings'
import { authenticateIdentity } from './identity'
import { jsonError, jsonSuccess } from './http'

interface ProgressRow {
  readonly edition_id: string
  readonly state: string
  readonly total_score: number
  readonly display_main: number
  readonly display_evidence: number
  readonly display_followup: number
  readonly issued_at: string
  readonly debrief_completed_at: string | null
  readonly public_metadata_json: string | null
}

export async function getProgress(
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

  const rows = await env.DB.prepare(
    `SELECT
       a.edition_id,
       a.state,
       rv.total_score,
       rv.display_main,
       rv.display_evidence,
       rv.display_followup,
       a.issued_at,
       a.debrief_completed_at,
       e.public_metadata_json
     FROM attempts a
     INNER JOIN result_versions rv
       ON rv.attempt_id = a.attempt_id AND rv.version = 1
     LEFT JOIN editions e
       ON e.edition_id = a.edition_id
     WHERE a.identity_id = ?
       AND a.mode = 'official'
       AND a.state IN ('decision_complete', 'debrief_complete')
       AND a.deleted_at IS NULL
     ORDER BY a.issued_at DESC`,
  )
    .bind(identity.identityId)
    .all<ProgressRow>()

  return jsonSuccess(
    {
      entries: rows.results.map((row) => {
        const metadata: Record<string, unknown> = row.public_metadata_json
          ? (JSON.parse(row.public_metadata_json) as Record<string, unknown>)
          : {}

        return {
          edition_id: row.edition_id,
          state: row.state,
          total_score: row.total_score,
          display_main: row.display_main,
          display_evidence: row.display_evidence,
          display_followup: row.display_followup,
          issued_at: row.issued_at,
          debrief_completed_at: row.debrief_completed_at,
          metadata,
        }
      }),
    },
    requestId,
  )
}
