import { z } from 'zod'

import { publicBriefSchema } from '../domain/public-brief'
import { publicFollowupSchema } from '../domain/public-followup'

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

const mainAnswerSchema = z
  .object({
    action_id: z.string().regex(/^[a-z0-9_]+$/).max(80),
    qualifier_id: z.string().regex(/^[a-z0-9_]+$/).max(80),
    evidence_ids: z
      .array(z.string().regex(/^[a-z0-9_]+$/).max(80))
      .length(2),
    confidence_id: z.string().regex(/^[a-z0-9_]+$/).max(80),
  })
  .strict()

const attemptBase = {
  attempt_id: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  edition_id: z.string().regex(/^[a-z0-9_]+$/).max(80),
  mode: z.literal('official'),
  assisted: z.literal(false),
  issued_at: z.iso.datetime(),
  grace_end_at: z.iso.datetime(),
}

const issuedAttemptDataSchema = z
  .object({
    attempt: z
      .object({
        ...attemptBase,
        state: z.literal('issued'),
        sequence: z.literal(0),
      })
      .strict(),
    brief: publicBriefSchema,
  })
  .strict()

const lockedAttemptDataSchema = z
  .object({
    attempt: z
      .object({
        ...attemptBase,
        state: z.literal('main_locked'),
        sequence: z.literal(1),
        main_committed_at: z.iso.datetime(),
      })
      .strict(),
    brief: publicBriefSchema,
    main_answer: mainAnswerSchema,
    followup: publicFollowupSchema,
  })
  .strict()

const attemptResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.union([issuedAttemptDataSchema, lockedAttemptDataSchema]),
    error: z.null(),
    meta: metaSchema,
  })
  .strict()

export type TodayData = z.infer<typeof todayResponseSchema>['data']
export type SessionData = z.infer<typeof sessionResponseSchema>['data']
export type AttemptData = z.infer<typeof attemptResponseSchema>['data']

const mainCommitResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        attempt: z
          .object({
            attempt_id: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
            state: z.literal('main_locked'),
            sequence: z.literal(1),
            main_committed_at: z.iso.datetime(),
          })
          .strict(),
        main_answer: mainAnswerSchema,
        followup: publicFollowupSchema,
      })
      .strict(),
    error: z.null(),
    meta: metaSchema,
  })
  .strict()

export type MainCommitData = z.infer<typeof mainCommitResponseSchema>['data']

export interface MainAnswerDraft {
  readonly case_revision: string
  readonly action_id: string
  readonly qualifier_id: string
  readonly evidence_ids: readonly [string, string]
  readonly confidence_id: string
}

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

export async function createAttempt(
  editionId: string,
  csrfToken: string,
): Promise<AttemptData> {
  const response = await fetch('/api/v1/attempts', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({ edition_id: editionId }),
  })
  const payload = await parseResponse(response, attemptResponseSchema)

  return payload.data
}

export async function commitMainAnswer(
  attemptId: string,
  csrfToken: string,
  idempotencyKey: string,
  answer: MainAnswerDraft,
): Promise<MainCommitData> {
  const response = await fetch(`/api/v1/attempts/${attemptId}/main-commit`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
      'if-match': '"0"',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(answer),
  })
  const payload = await parseResponse(response, mainCommitResponseSchema)

  return payload.data
}
