import type { Bindings } from './bindings'
import { authenticateIdentity, verifyCsrfToken } from './identity'
import { jsonError, jsonSuccess } from './http'
import { acceptsStateChangingHeaders } from './request-protection'

export async function deleteHistory(
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

  const now = new Date().toISOString()

  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM participation_credits WHERE identity_id = ?`,
    ).bind(identity.identityId),
    env.DB.prepare(
      `DELETE FROM result_versions WHERE attempt_id IN (
        SELECT attempt_id FROM attempts WHERE identity_id = ?
      )`,
    ).bind(identity.identityId),
    env.DB.prepare(
      `DELETE FROM idempotency_receipts WHERE attempt_id IN (
        SELECT attempt_id FROM attempts WHERE identity_id = ?
      )`,
    ).bind(identity.identityId),
    env.DB.prepare(
      `DELETE FROM attempt_commits WHERE attempt_id IN (
        SELECT attempt_id FROM attempts WHERE identity_id = ?
      )`,
    ).bind(identity.identityId),
    env.DB.prepare(
      `DELETE FROM fairness_reports WHERE attempt_id IN (
        SELECT attempt_id FROM attempts WHERE identity_id = ?
      )`,
    ).bind(identity.identityId),
    env.DB.prepare(
      `DELETE FROM attempts WHERE identity_id = ?`,
    ).bind(identity.identityId),
    env.DB.prepare(
      `UPDATE anonymous_identities
       SET status = 'deleted', deleted_at = ?
       WHERE identity_id = ?`,
    ).bind(now, identity.identityId),
  ])

  return jsonSuccess({ deleted: true }, requestId)
}
