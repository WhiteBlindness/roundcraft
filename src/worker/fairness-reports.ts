import { z } from 'zod'

import type { Bindings } from './bindings'
import { authenticateIdentity, verifyCsrfToken } from './identity'
import { jsonError, jsonSuccess } from './http'
import {
  acceptsStateChangingHeaders,
  maximumStateChangingBodyBytes,
} from './request-protection'

const attemptPattern = /^[A-Za-z0-9_-]{43}$/

const validCategories = [
  'missing_action',
  'missing_qualifier',
  'missing_evidence',
  'incorrect_disclosed_fact',
  'other',
] as const

const reportBodySchema = z
  .object({
    attempt_id: z.string().regex(attemptPattern),
    category: z.enum(validCategories),
  })
  .strict()

export async function createFairnessReport(
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

  let body: z.infer<typeof reportBodySchema>
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
    body = reportBodySchema.parse(JSON.parse(text))
  } catch {
    return jsonError(
      422,
      'VALIDATION_ERROR',
      'The submitted data is invalid.',
      requestId,
    )
  }

  const attempt = await env.DB.prepare(
    `SELECT attempt_id FROM attempts
     WHERE attempt_id = ? AND identity_id = ? AND deleted_at IS NULL
     LIMIT 1`,
  )
    .bind(body.attempt_id, identity.identityId)
    .first<{ attempt_id: string }>()

  if (!attempt) {
    return jsonError(
      404,
      'ATTEMPT_NOT_FOUND',
      'The attempt is unavailable.',
      requestId,
    )
  }

  const reportId = crypto.randomUUID()
  const now = new Date().toISOString()

  await env.DB.prepare(
    `INSERT INTO fairness_reports (
      report_id, attempt_id, category, status, created_at
    ) VALUES (?, ?, ?, 'open', ?)`,
  )
    .bind(reportId, body.attempt_id, body.category, now)
    .run()

  return jsonSuccess({ report_id: reportId }, requestId)
}
