import { z } from 'zod'

import { followupAnswerSchema, type FollowupAnswer } from '../domain/followup-answer'
import { publicBriefSchema } from '../domain/public-brief'
import { publicFollowupSchema } from '../domain/public-followup'
import { publicResultSchema } from '../domain/public-result'
import { publicRevealSchema } from '../domain/public-reveal'

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

const completedAttemptDataSchema = z
  .object({
    attempt: z.discriminatedUnion('state', [
      z
        .object({
          ...attemptBase,
          state: z.literal('decision_complete'),
          sequence: z.literal(2),
          main_committed_at: z.iso.datetime(),
          followup_committed_at: z.iso.datetime(),
        })
        .strict(),
      z
        .object({
          ...attemptBase,
          state: z.literal('debrief_complete'),
          sequence: z.literal(3),
          main_committed_at: z.iso.datetime(),
          followup_committed_at: z.iso.datetime(),
          debrief_completed_at: z.iso.datetime(),
        })
        .strict(),
    ]),
    brief: publicBriefSchema,
    main_answer: mainAnswerSchema,
    followup: publicFollowupSchema,
    followup_answer: followupAnswerSchema,
    result: publicResultSchema,
    reveal: publicRevealSchema,
  })
  .strict()

const attemptResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.union([
      issuedAttemptDataSchema,
      lockedAttemptDataSchema,
      completedAttemptDataSchema,
    ]),
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

const followupCommitResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        attempt: z
          .object({
            attempt_id: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
            state: z.literal('decision_complete'),
            sequence: z.literal(2),
            followup_committed_at: z.iso.datetime(),
          })
          .strict(),
        main_answer: mainAnswerSchema,
        followup_answer: followupAnswerSchema,
        result: publicResultSchema,
        reveal: publicRevealSchema,
      })
      .strict(),
    error: z.null(),
    meta: metaSchema,
  })
  .strict()

export type FollowupCommitData = z.infer<
  typeof followupCommitResponseSchema
>['data']

const debriefCompleteResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        attempt: z
          .object({
            attempt_id: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
            state: z.literal('debrief_complete'),
            sequence: z.literal(3),
            debrief_completed_at: z.iso.datetime(),
          })
          .strict(),
      })
      .strict(),
    error: z.null(),
    meta: metaSchema,
  })
  .strict()

export type DebriefCompleteData = z.infer<
  typeof debriefCompleteResponseSchema
>['data']

export interface MainAnswerDraft {
  readonly case_revision: string
  readonly action_id: string
  readonly qualifier_id: string
  readonly evidence_ids: readonly [string, string]
  readonly confidence_id: string
}

export type FollowupAnswerDraft = FollowupAnswer

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

export async function commitFollowupAnswer(
  attemptId: string,
  csrfToken: string,
  idempotencyKey: string,
  answer: FollowupAnswerDraft,
): Promise<FollowupCommitData> {
  const response = await fetch(`/api/v1/attempts/${attemptId}/followup-commit`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
      'if-match': '"1"',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(answer),
  })
  const payload = await parseResponse(response, followupCommitResponseSchema)

  return payload.data
}

export async function completeDebrief(
  attemptId: string,
  csrfToken: string,
): Promise<DebriefCompleteData> {
  const response = await fetch(
    `/api/v1/attempts/${attemptId}/debrief-complete`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        'if-match': '"2"',
        'x-csrf-token': csrfToken,
      },
      body: '{}',
    },
  )
  const payload = await parseResponse(response, debriefCompleteResponseSchema)

  return payload.data
}

const progressEntrySchema = z
  .object({
    edition_id: z.string().regex(/^[a-z0-9_]+$/).max(80),
    state: z.enum(['decision_complete', 'debrief_complete']),
    total_score: z.number().int().min(0).max(100),
    display_main: z.number().int().min(0).max(50),
    display_evidence: z.number().int().min(0).max(20),
    display_followup: z.number().int().min(0).max(30),
    issued_at: z.iso.datetime(),
    debrief_completed_at: z.iso.datetime().nullable(),
  })
  .strict()

const progressResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        entries: z.array(progressEntrySchema),
      })
      .strict(),
    error: z.null(),
    meta: metaSchema,
  })
  .strict()

export type ProgressEntry = z.infer<typeof progressEntrySchema>
export type ProgressData = z.infer<typeof progressResponseSchema>['data']

export async function loadProgress(): Promise<ProgressData> {
  const response = await fetch('/api/v1/progress', {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  })
  const payload = await parseResponse(response, progressResponseSchema)

  return payload.data
}

const casesEditionSchema = z
  .object({
    edition_id: z.string().regex(/^[a-z0-9_]+$/).max(80),
    release_at: z.iso.datetime(),
    metadata: z.record(z.string(), z.unknown()),
  })
  .strict()

const casesResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        editions: z.array(casesEditionSchema),
        next_cursor: z.string().nullable().optional(),
      })
      .strict(),
    error: z.null(),
    meta: metaSchema,
  })
  .strict()

export type CasesEdition = z.infer<typeof casesEditionSchema>
export type CasesData = z.infer<typeof casesResponseSchema>['data']

export async function loadCases(cursor?: string): Promise<CasesData> {
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)
  const query = params.toString()
  const url = query ? `/api/v1/cases?${query}` : '/api/v1/cases'

  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  })
  const payload = await parseResponse(response, casesResponseSchema)

  return payload.data
}

const practiceAttemptBase = {
  attempt_id: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  edition_id: z.string().regex(/^[a-z0-9_]+$/).max(80),
  mode: z.literal('practice'),
  assisted: z.literal(false),
  issued_at: z.iso.datetime(),
  grace_end_at: z.iso.datetime(),
}

const practiceAttemptResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        attempt: z
          .object({
            ...practiceAttemptBase,
            state: z.literal('issued'),
            sequence: z.literal(0),
          })
          .strict(),
        brief: publicBriefSchema,
      })
      .strict(),
    error: z.null(),
    meta: metaSchema,
  })
  .strict()

export type PracticeAttemptData = z.infer<
  typeof practiceAttemptResponseSchema
>['data']

export async function createPracticeAttempt(
  editionId: string,
  csrfToken: string,
): Promise<PracticeAttemptData> {
  const response = await fetch('/api/v1/practice-attempts', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({ edition_id: editionId }),
  })
  const payload = await parseResponse(response, practiceAttemptResponseSchema)

  return payload.data
}

const fairnessReportResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        report_id: z.uuid(),
      })
      .strict(),
    error: z.null(),
    meta: metaSchema,
  })
  .strict()

export type FairnessReportData = z.infer<
  typeof fairnessReportResponseSchema
>['data']

export type FairnessCategory =
  | 'missing_action'
  | 'missing_qualifier'
  | 'missing_evidence'
  | 'incorrect_disclosed_fact'
  | 'other'

export async function createFairnessReport(
  attemptId: string,
  category: FairnessCategory,
  csrfToken: string,
): Promise<FairnessReportData> {
  const response = await fetch('/api/v1/fairness-reports', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({ attempt_id: attemptId, category }),
  })
  const payload = await parseResponse(response, fairnessReportResponseSchema)

  return payload.data
}

const eventsResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        accepted: z.literal(true),
      })
      .strict(),
    error: z.null(),
    meta: metaSchema,
  })
  .strict()

export type EventName =
  | 'today_loaded'
  | 'attempt_issued'
  | 'attempt_resumed'
  | 'state_reached'
  | 'main_committed'
  | 'followup_committed'
  | 'decision_complete'
  | 'debrief_opened'
  | 'debrief_complete'
  | 'sources_opened'
  | 'share_invoked'
  | 'fairness_reported'
  | 'return_visit'

export interface EventProperties {
  readonly edition_id?: string
  readonly mode?: 'official' | 'practice'
  readonly assisted?: boolean
  readonly state_name?: string
  readonly version?: string
  readonly surface?: string
}

export async function recordEvent(
  eventName: EventName,
  properties: EventProperties,
  csrfToken: string,
): Promise<void> {
  try {
    const response = await fetch('/api/v1/events', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ event_name: eventName, properties }),
    })
    await parseResponse(response, eventsResponseSchema)
  } catch {
    // Analytics failures are silently discarded.
  }
}

const deleteHistoryResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        deleted: z.literal(true),
      })
      .strict(),
    error: z.null(),
    meta: metaSchema,
  })
  .strict()

export async function deleteHistory(
  csrfToken: string,
): Promise<void> {
  const response = await fetch('/api/v1/history', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: '{}',
  })
  await parseResponse(response, deleteHistoryResponseSchema)
}
