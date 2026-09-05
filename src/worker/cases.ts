import type { Bindings } from './bindings'
import { jsonError, jsonSuccess } from './http'

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
      `SELECT edition_id, release_at, public_metadata_json
       FROM editions
       WHERE publication_status = 'released'
         AND release_at <= ?
         AND edition_id < ?
       ORDER BY release_at DESC, edition_id DESC
       LIMIT ?`,
    )
      .bind(new Date().toISOString(), cursor, queryLimit)
      .all<EditionRow>()
  } else {
    rows = await env.DB.prepare(
      `SELECT edition_id, release_at, public_metadata_json
       FROM editions
       WHERE publication_status = 'released'
         AND release_at <= ?
       ORDER BY release_at DESC, edition_id DESC
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
      editions: editions.map((row) => ({
        edition_id: row.edition_id,
        release_at: row.release_at,
        metadata: JSON.parse(row.public_metadata_json) as unknown,
      })),
      next_cursor: nextCursor,
    },
    requestId,
  )
}
