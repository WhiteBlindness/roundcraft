import { z } from 'zod'

const metaSchema = z.object({
  request_id: z.uuid(),
  api_version: z.literal('v1'),
})

const availableTodaySchema = z.object({
  availability: z.literal('available'),
  edition: z.object({
    edition_id: z.string().regex(/^[a-z0-9_]+$/).max(80),
    case_number: z.number().int().positive(),
    edition_date_utc: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    estimated_minutes: z.number().int().min(5).max(8),
    focus: z.string().min(1).max(80),
    status: z.enum([
      'new',
      'in_progress',
      'result_pending',
      'update_required',
      'decision_complete',
      'complete',
      'corrected',
      'withdrawn',
    ]),
    primary_action: z.enum([
      'start_case',
      'continue',
      'retry_result',
      'refresh_case',
      'view_debrief',
      'review',
      'read_correction',
      'view_neutral_record',
    ]),
    origin: z.enum(['synthetic', 'professional']),
    origin_label: z.string().min(1).max(160),
  }),
})

const unavailableTodaySchema = z.object({
  availability: z.literal('unavailable'),
  edition: z.null(),
  status: z.literal('unavailable'),
  primary_action: z.literal('retry_later'),
})

const todayResponseSchema = z.object({
  ok: z.literal(true),
  data: z.discriminatedUnion('availability', [
    availableTodaySchema,
    unavailableTodaySchema,
  ]),
  error: z.null(),
  meta: metaSchema,
})

const sessionResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    csrf_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    identity_expires_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
  }),
  error: z.null(),
  meta: metaSchema,
})

export type TodayData = z.infer<typeof todayResponseSchema>['data']
export type SessionData = z.infer<typeof sessionResponseSchema>['data']

async function parseResponse<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!response.ok) {
    throw new Error('The service is temporarily unavailable.')
  }

  const payload: unknown = await response.json()
  const parsed = schema.safeParse(payload)

  if (!parsed.success) {
    throw new Error('The service returned an invalid response.')
  }

  return parsed.data
}

export async function loadToday(): Promise<TodayData> {
  const response = await fetch('/api/v1/today', {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  })
  const payload = await parseResponse(response, todayResponseSchema)

  return payload.data
}

export async function createSession(): Promise<SessionData> {
  const response = await fetch('/api/v1/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  const payload = await parseResponse(response, sessionResponseSchema)

  return payload.data
}
