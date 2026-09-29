import type { Bindings } from './bindings'
import { parsePublicMetadata } from './edition-metadata'
import { jsonError, jsonSuccess } from './http'
import { logEvent, requestLogContext } from './log'
import { playableRevisionSql } from './playable'

const defaultLimit = 20
const maxLimit = 50

interface EditionRow {
  readonly edition_id: string
  readonly release_at: string
  readonly public_metadata_json: string
}

export async function listCases(
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

  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor')
  const limitParam = url.searchParams.get('limit')
  const limit = limitParam
    ? Math.min(Math.max(parseInt(limitParam, 10) || defaultLimit, 1), maxLimit)
    : defaultLimit

  const queryLimit = limit + 1

  let rows: D1Result<EditionRow>
  if (cursor) {
    rows = await env.DB.prepare(
      `SELECT e.edition_id, e.release_at, e.public_metadata_json
       FROM editions AS e
       INNER JOIN case_revisions AS cr ON cr.case_revision = e.case_revision
       WHERE ${playableRevisionSql}
         AND e.release_at <= ?
         AND e.edition_id < ?
       ORDER BY e.release_at DESC, e.edition_id DESC
       LIMIT ?`,
    )
      .bind(new Date().toISOString(), cursor, queryLimit)
      .all<EditionRow>()
  } else {
    rows = await env.DB.prepare(
      `SELECT e.edition_id, e.release_at, e.public_metadata_json
       FROM editions AS e
       INNER JOIN case_revisions AS cr ON cr.case_revision = e.case_revision
       WHERE ${playableRevisionSql}
         AND e.release_at <= ?
       ORDER BY e.release_at DESC, e.edition_id DESC
       LIMIT ?`,
    )
      .bind(new Date().toISOString(), queryLimit)
      .all<EditionRow>()
  }

  const hasMore = rows.results.length > limit
  const editions = rows.results.slice(0, limit)
  const lastEdition = editions[editions.length - 1]
  const nextCursor = hasMore && lastEdition
    ? lastEdition.edition_id
    : null

  return jsonSuccess(
    {
      editions: editions.map((row) => {
        const metadata = parsePublicMetadata(row.public_metadata_json)

        if (!metadata) {
          logEvent('error', 'content_unavailable', {
            ...requestLogContext(request, requestId),
            edition_id: row.edition_id,
            payload: 'public_metadata',
            reason: 'invalid',
          })
        }

        return {
          edition_id: row.edition_id,
          release_at: row.release_at,
          metadata,
        }
      }),
      next_cursor: nextCursor,
    },
    requestId,
  )
}
