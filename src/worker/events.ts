import { z } from 'zod'

import type { Bindings } from './bindings'
import { authenticateIdentity, verifyCsrfToken } from './identity'
import { jsonError, jsonSuccess } from './http'
import {
  acceptsStateChangingHeaders,
  maximumStateChangingBodyBytes,
} from './request-protection'

const allowedEvents = [
  'today_loaded',
  'attempt_issued',
  'attempt_resumed',
  'state_reached',
  'main_committed',
  'followup_committed',
  'decision_complete',
  'debrief_opened',
  'debrief_complete',
  'sources_opened',
  'share_invoked',
  'fairness_reported',
  'return_visit',
] as const

const safeIdPattern = /^[a-z0-9_]+$/
const safeVersionPattern = /^[a-z0-9_.]+$/

const propertiesSchema = z
  .object({
    edition_id: z.string().regex(safeIdPattern).max(80).optional(),
    mode: z.enum(['official', 'practice']).optional(),
    assisted: z.boolean().optional(),
    state_name: z.string().regex(safeIdPattern).max(40).optional(),
    version: z.string().regex(safeVersionPattern).max(40).optional(),
    surface: z.string().regex(safeIdPattern).max(40).optional(),
  })
  .strict()

const eventBodySchema = z
  .object({
    event_name: z.enum(allowedEvents),
    properties: propertiesSchema,
  })
  .strict()

const eventRetentionDays = 90

export async function recordEvent(
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

  let body: z.infer<typeof eventBodySchema>
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
    body = eventBodySchema.parse(JSON.parse(text))
  } catch {
    return jsonError(
      422,
      'VALIDATION_ERROR',
      'The submitted data is invalid.',
      requestId,
    )
  }

  const eventId = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(
    now.getTime() + eventRetentionDays * 24 * 60 * 60 * 1000,
  )

  await env.DB.prepare(
    `INSERT INTO analytics_events (
      event_id, event_name, schema_version, edition_id, mode, assisted,
      properties_json, occurred_at, expires_at
    ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      eventId,
      body.event_name,
      body.properties.edition_id ?? null,
      body.properties.mode ?? null,
      body.properties.assisted !== undefined
        ? body.properties.assisted
          ? 1
          : 0
        : null,
      JSON.stringify(body.properties),
      now.toISOString(),
      expiresAt.toISOString(),
    )
    .run()

  return jsonSuccess({ accepted: true }, requestId)
}
