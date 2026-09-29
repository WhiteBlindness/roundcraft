import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Bindings } from './bindings'
import worker from './index'

const executionContext = {} as ExecutionContext
const apiOrigin = 'https://roundcraft.test'
const editionId = 'edition_followup_001'
const caseRevision = 'case_revision_followup_001'

const brief = {
  schemaVersion: 1,
  editionId,
  caseRevision,
  title: 'The last smoke',
  focus: 'Resource allocation under uncertainty',
  origin: 'synthetic',
  facts: [
    { id: 'bomb', status: 'confirmed', text: 'The bomb is down outside B.' },
    { id: 'anchor', status: 'last_seen', text: 'One defender was last seen at A.' },
  ],
  actions: [
    { id: 'regroup_a', label: 'Regroup toward A', qualifierIds: ['quiet', 'fast'] },
    { id: 'pressure_mid', label: 'Pressure middle', qualifierIds: ['paired', 'delayed'] },
    { id: 'hold_shape', label: 'Hold the current shape', qualifierIds: ['passive', 'contact'] },
  ],
  qualifiers: [
    { id: 'quiet', label: 'Quietly' },
    { id: 'fast', label: 'Immediately' },
    { id: 'paired', label: 'As a pair' },
    { id: 'delayed', label: 'After a delay' },
    { id: 'passive', label: 'Without taking space' },
    { id: 'contact', label: 'On contact' },
  ],
  evidence: [
    { id: 'bomb_location', label: 'Bomb location' },
    { id: 'last_sighting', label: 'Last defender sighting' },
    { id: 'utility', label: 'Remaining utility' },
    { id: 'clock', label: 'Round clock' },
    { id: 'spacing', label: 'Trade spacing' },
  ],
  confidence: [
    { id: 'guessing', label: 'Guessing' },
    { id: 'leaning', label: 'Leaning' },
    { id: 'fairly_sure', label: 'Fairly sure' },
    { id: 'strong_read', label: 'Strong read' },
  ],
} as const

const followup = {
  schemaVersion: 1,
  caseRevision,
  type: 'new_information',
  heading: 'The round changed',
  stimulus: 'Eight seconds pass before a defender is heard rotating.',
  updates: [
    { id: 'rotation', status: 'new', text: 'A defender is heard leaving B.' },
  ],
  responses: [
    { id: 'keep_original', label: 'Keep the original line' },
    { id: 'change_mid', label: 'Change to pressure middle' },
  ],
} as const

const reveal = {
  schemaVersion: 1,
  caseRevision,
  continuation: {
    kind: 'authored',
    events: [
      {
        timestamp: '00:23',
        action: 'The pair re-cleared middle.',
        consequence: 'The rotation was confirmed before the final commitment.',
        state: 'The round ended with a supported A split.',
      },
    ],
  },
  comparison: {
    roundAction: 'Re-clear middle before committing.',
    materialInformation: 'The aged B sighting and the new rotation sound.',
    roundFollowup: 'The authored line changed after the new sound cue.',
  },
  debrief: {
    whyItWorks: 'It refreshes the oldest decisive information.',
    cost: 'It spends time and gives up immediate site pressure.',
    assumption: 'The pair can trade the re-clear.',
    breaksWhen: 'The clock no longer permits a second route.',
    evidenceReview: [
      {
        evidenceId: 'bomb_location',
        explanation: 'The bomb position preserved both routes.',
      },
      {
        evidenceId: 'utility',
        explanation: 'The smoke made the re-clear survivable.',
      },
    ],
    followupReview: 'Changing line responded directly to the new information.',
    strongestAlternative: 'Keep the line, but accelerate before the cue ages.',
    counterfactual: {
      changedFact: 'Remove the rotation sound.',
      effect: 'Keeping the original line becomes equally strong.',
    },
    method: 'Synthetic case reviewed against the disclosed state only.',
    sources: [
      { label: 'Roundcraft method', detail: 'Synthetic authored continuation.' },
    ],
  },
  principle:
    'When new information invalidates the route assumption, refresh the decision before committing the remaining time.',
} as const

const rubric = {
  schemaVersion: 1,
  caseRevision,
  rubricRevision: 'rubric_revision_followup_001',
  dimensions: [
    { id: 'timing', weight: 60 },
    { id: 'trade', weight: 40 },
  ],
  main: [
    {
      actionId: 'regroup_a',
      qualifierId: 'quiet',
      ratings: { timing: 4, trade: 3 },
      caps: [],
    },
  ],
  evidence: [
    {
      actionId: 'regroup_a',
      evidenceIds: ['bomb_location', 'utility'],
      points: 16,
    },
  ],
  followup: {
    type: 'new_information',
    responses: [
      { responseId: 'keep_original', quality: 58 },
      { responseId: 'change_mid', quality: 92 },
    ],
  },
} as const

const mainAnswer = {
  case_revision: caseRevision,
  action_id: 'regroup_a',
  qualifier_id: 'quiet',
  evidence_ids: ['bomb_location', 'utility'],
  confidence_id: 'fairly_sure',
} as const
const followupAnswer = {
  case_revision: caseRevision,
  type: 'new_information',
  response_id: 'change_mid',
} as const

function protectedRequest(
  path: string,
  identity: { cookie: string; csrf: string },
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(`${apiOrigin}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: identity.cookie,
      origin: apiOrigin,
      'sec-fetch-site': 'same-origin',
      'x-csrf-token': identity.csrf,
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

async function createIdentity() {
  const response = await worker.fetch(
    new Request(`${apiOrigin}/api/v1/session`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: apiOrigin,
        'sec-fetch-site': 'same-origin',
      },
      body: '{}',
    }),
    env,
    executionContext,
  )
  const payload = await response.json<{ data: { csrf_token: string } }>()

  return {
    cookie: response.headers.get('set-cookie')?.split(';', 1)[0] ?? '',
    csrf: payload.data.csrf_token,
  }
}

function mainCommitRequest(
  identity: { cookie: string; csrf: string },
  attemptId: string,
) {
  return protectedRequest(
    `/api/v1/attempts/${attemptId}/main-commit`,
    identity,
    mainAnswer,
    {
      'idempotency-key': '9fd0debf-8f44-4a19-a4e8-a123a1132b24',
      'if-match': '"0"',
    },
  )
}

function followupCommitRequest(
  identity: { cookie: string; csrf: string },
  attemptId: string,
  body: unknown = followupAnswer,
  idempotencyKey = '74a35f6d-4237-499f-b248-4bca66ac9a3a',
  ifMatch = '"1"',
) {
  return protectedRequest(
    `/api/v1/attempts/${attemptId}/followup-commit`,
    identity,
    body,
    { 'idempotency-key': idempotencyKey, 'if-match': ifMatch },
  )
}

function debriefCompleteRequest(
  identity: { cookie: string; csrf: string },
  attemptId: string,
  body: unknown = {},
  ifMatch = '"2"',
) {
  return protectedRequest(
    `/api/v1/attempts/${attemptId}/debrief-complete`,
    identity,
    body,
    { 'if-match': ifMatch },
  )
}

async function createMainLockedAttempt(identity: {
  cookie: string
  csrf: string
}) {
  const created = await worker.fetch(
    protectedRequest('/api/v1/attempts', identity, { edition_id: editionId }),
    env,
    executionContext,
  )
  const payload = await created.json<{ data: { attempt: { attempt_id: string } } }>()
  await worker.fetch(
    mainCommitRequest(identity, payload.data.attempt.attempt_id),
    env,
    executionContext,
  )

  return payload.data.attempt.attempt_id
}

async function seedCase() {
  const createdAt = '2026-09-01T00:00:00.000Z'

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO cases (case_id, origin, created_at) VALUES (?, 'synthetic', ?)`,
    ).bind('case_followup_001', createdAt),
    env.DB.prepare(
      `INSERT INTO case_revisions
       (case_revision, case_id, schema_version, checksum, status, created_at)
       VALUES (?, ?, 1, ?, 'locked', ?)`,
    ).bind(caseRevision, 'case_followup_001', 'checksum_followup_001', createdAt),
    env.DB.prepare(
      `INSERT INTO editions
       (edition_id, case_revision, release_at, official_end_at, grace_end_at,
        publication_status, public_metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, 'released', ?, ?)`,
    ).bind(
      editionId,
      caseRevision,
      '2026-01-01T00:00:00.000Z',
      '2099-01-01T00:00:00.000Z',
      '2099-01-01T12:00:00.000Z',
      JSON.stringify({ case_number: 1 }),
      createdAt,
    ),
    env.DB.prepare(
      `INSERT INTO case_public_briefs
       (case_revision, payload_json, checksum, created_at) VALUES (?, ?, ?, ?)`,
    ).bind(caseRevision, JSON.stringify(brief), 'brief_followup_001', createdAt),
    env.DB.prepare(
      `INSERT INTO case_followups
       (case_revision, payload_json, checksum, created_at) VALUES (?, ?, ?, ?)`,
    ).bind(caseRevision, JSON.stringify(followup), 'followup_followup_001', createdAt),
    env.DB.prepare(
      `INSERT INTO case_reveals
       (case_revision, payload_json, checksum, created_at) VALUES (?, ?, ?, ?)`,
    ).bind(caseRevision, JSON.stringify(reveal), 'reveal_followup_001', createdAt),
    env.DB.prepare(
      `INSERT INTO case_rubrics
       (rubric_revision, case_revision, payload_json, checksum, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(
      rubric.rubricRevision,
      caseRevision,
      JSON.stringify(rubric),
      'rubric_followup_001',
      createdAt,
    ),
  ])
}

describe('follow-up commitment API', () => {
  beforeEach(async () => {
    await env.DB.exec(
      `DELETE FROM participation_credits;
       DELETE FROM result_versions;
       DELETE FROM idempotency_receipts;
       DELETE FROM attempt_commits;
       DELETE FROM attempts;
       DELETE FROM case_rubrics;
       DELETE FROM case_reveals;
       DELETE FROM case_followups;
       DELETE FROM case_public_briefs;
       DELETE FROM editions;
       DELETE FROM case_revisions;
       DELETE FROM cases;
       DELETE FROM anonymous_identities;`,
    )
    await seedCase()
  })

  it('atomically locks a valid response, scores it and awards participation', async () => {
    const identity = await createIdentity()
    const attemptId = await createMainLockedAttempt(identity)
    const response = await worker.fetch(
      followupCommitRequest(identity, attemptId),
      env,
      executionContext,
    )
    const text = await response.text()
    const payload = JSON.parse(text)
    const attempt = await env.DB.prepare(
      `SELECT state, sequence, followup_committed_at FROM attempts WHERE attempt_id = ?`,
    ).bind(attemptId).first<{ state: string; sequence: number }>()
    const result = await env.DB.prepare(
      `SELECT total_score, display_main, display_evidence, display_followup
       FROM result_versions WHERE attempt_id = ?`,
    ).bind(attemptId).first<Record<string, number>>()
    const participation = await env.DB.prepare(
      `SELECT status FROM participation_credits WHERE attempt_id = ?`,
    ).bind(attemptId).first<{ status: string }>()

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"2"')
    expect(payload.data).toMatchObject({
      attempt: { attempt_id: attemptId, state: 'decision_complete', sequence: 2 },
      followup_answer: followupAnswer,
      result: {
        version: 1,
        total: 89,
        components: { main: 45, evidence: 16, followup: 28 },
        main_band: 'Best-supported',
        followup_band: 'Best-supported',
        confidence_id: 'fairly_sure',
        participation: 'awarded',
      },
      reveal,
    })
    expect(attempt).toMatchObject({ state: 'decision_complete', sequence: 2 })
    expect(result).toMatchObject({
      total_score: 89,
      display_main: 45,
      display_evidence: 16,
      display_followup: 28,
    })
    expect(participation).toEqual({ status: 'awarded' })
    expect(text).not.toMatch(
      /rubricRevision|qualityQuarterUnits|exactTotalUnits|ratings|dimensions/,
    )
  })

  it('returns the identical stored result for the same key and body', async () => {
    const identity = await createIdentity()
    const attemptId = await createMainLockedAttempt(identity)
    const first = await worker.fetch(
      followupCommitRequest(identity, attemptId),
      env,
      executionContext,
    )
    const second = await worker.fetch(
      followupCommitRequest(identity, attemptId),
      env,
      executionContext,
    )

    expect(second.status).toBe(200)
    expect(await second.text()).toBe(await first.text())
  })

  it('scores one whitelisted Economy/Risk posture and priority pair', async () => {
    const economyFollowup = {
      schemaVersion: 1,
      caseRevision,
      type: 'economy_risk',
      heading: 'Choose the risk posture',
      stimulus: 'The current buy changes the protected next-round reserve.',
      updates: [
        { id: 'reserve', status: 'changed', text: 'Protected reserve: $2,100.' },
      ],
      postures: [
        { id: 'protect', label: 'Protect the next buy' },
        { id: 'press', label: 'Press this round' },
      ],
      priorities: [
        { id: 'utility', label: 'Keep utility' },
        { id: 'rifle', label: 'Keep the rifle' },
      ],
    } as const
    const economyRubric = {
      ...rubric,
      main: [{ ...rubric.main[0], sharedConsensus: true }],
      followup: {
        type: 'economy_risk',
        pairs: [
          {
            postureId: 'protect',
            priorityId: 'utility',
            quality: 95,
            sharedConsensus: true,
          },
          { postureId: 'protect', priorityId: 'rifle', quality: 70 },
          { postureId: 'press', priorityId: 'utility', quality: 55 },
          { postureId: 'press', priorityId: 'rifle', quality: 45 },
        ],
      },
    } as const
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE case_followups SET payload_json = ? WHERE case_revision = ?`,
      ).bind(JSON.stringify(economyFollowup), caseRevision),
      env.DB.prepare(
        `UPDATE case_rubrics SET payload_json = ? WHERE rubric_revision = ?`,
      ).bind(JSON.stringify(economyRubric), rubric.rubricRevision),
    ])
    const identity = await createIdentity()
    const attemptId = await createMainLockedAttempt(identity)
    const response = await worker.fetch(
      followupCommitRequest(identity, attemptId, {
        case_revision: caseRevision,
        type: 'economy_risk',
        posture_id: 'protect',
        priority_id: 'utility',
      }),
      env,
      executionContext,
    )
    const payload = await response.json<{
      data: {
        result: {
          total: number
          components: { main: number; evidence: number; followup: number }
          main_band: string
          followup_band: string
        }
      }
    }>()

    expect(response.status).toBe(200)
    expect(payload.data.result).toMatchObject({
      total: 90,
      components: { main: 45, evidence: 16, followup: 29 },
      main_band: 'Equally strong',
      followup_band: 'Equally strong',
    })
  })

  it('resumes the complete authorised projection without private scoring data', async () => {
    const identity = await createIdentity()
    const attemptId = await createMainLockedAttempt(identity)
    await worker.fetch(followupCommitRequest(identity, attemptId), env, executionContext)

    const response = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/attempts/${attemptId}`, {
        headers: { cookie: identity.cookie },
      }),
      env,
      executionContext,
    )
    const text = await response.text()
    const payload = JSON.parse(text)

    expect(response.status).toBe(200)
    expect(payload.data).toMatchObject({
      attempt: { state: 'decision_complete', sequence: 2 },
      main_answer: {
        action_id: 'regroup_a',
        qualifier_id: 'quiet',
      },
      followup_answer: followupAnswer,
      result: { total: 89, participation: 'awarded' },
      reveal,
    })
    expect(text).not.toMatch(
      /rubricRevision|qualityQuarterUnits|exactTotalUnits|ratings|dimensions/,
    )
  })

  it('rejects invalid, stale and forged responses without result writes', async () => {
    const identity = await createIdentity()
    const attemptId = await createMainLockedAttempt(identity)
    const invalid = await worker.fetch(
      followupCommitRequest(identity, attemptId, {
        ...followupAnswer,
        response_id: 'not_published',
      }),
      env,
      executionContext,
    )
    const stale = await worker.fetch(
      followupCommitRequest(identity, attemptId, followupAnswer, undefined, '"7"'),
      env,
      executionContext,
    )
    const forged = await worker.fetch(
      followupCommitRequest({ ...identity, csrf: 'x'.repeat(43) }, attemptId),
      env,
      executionContext,
    )
    const resultCount = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM result_versions WHERE attempt_id = ?`,
    ).bind(attemptId).first<{ count: number }>()

    expect(invalid.status).toBe(422)
    expect(stale.status).toBe(409)
    expect(forged.status).toBe(403)
    expect(resultCount?.count).toBe(0)
  })

  it('does not reuse a key for another body or replace the winning branch', async () => {
    const identity = await createIdentity()
    const attemptId = await createMainLockedAttempt(identity)
    await worker.fetch(followupCommitRequest(identity, attemptId), env, executionContext)

    const reused = await worker.fetch(
      followupCommitRequest(identity, attemptId, {
        ...followupAnswer,
        response_id: 'keep_original',
      }),
      env,
      executionContext,
    )
    const replacement = await worker.fetch(
      followupCommitRequest(
        identity,
        attemptId,
        { ...followupAnswer, response_id: 'keep_original' },
        '5f831bf1-813b-4b9c-b564-c9f8c69032ce',
      ),
      env,
      executionContext,
    )

    expect(reused.status).toBe(409)
    expect(await reused.json()).toMatchObject({
      error: { code: 'IDEMPOTENCY_KEY_REUSED' },
    })
    expect(replacement.status).toBe(409)
    expect(await replacement.json()).toMatchObject({
      error: { code: 'ATTEMPT_STATE_CONFLICT' },
    })
  })

  it('accepts exactly one concurrent follow-up branch', async () => {
    const identity = await createIdentity()
    const attemptId = await createMainLockedAttempt(identity)
    const [first, second] = await Promise.all([
      worker.fetch(followupCommitRequest(identity, attemptId), env, executionContext),
      worker.fetch(
        followupCommitRequest(
          identity,
          attemptId,
          { ...followupAnswer, response_id: 'keep_original' },
          '5f831bf1-813b-4b9c-b564-c9f8c69032ce',
        ),
        env,
        executionContext,
      ),
    ])
    const count = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM result_versions WHERE attempt_id = ?`,
    ).bind(attemptId).first<{ count: number }>()

    expect([first.status, second.status].sort()).toEqual([200, 409])
    expect(count?.count).toBe(1)
  })

  it('rate-limits before writing a result', async () => {
    const identity = await createIdentity()
    const attemptId = await createMainLockedAttempt(identity)
    const limit = vi.fn().mockResolvedValue({ success: false })
    const limitedEnv: Bindings = {
      APP_ENV: env.APP_ENV,
      DB: env.DB,
      IDENTITY_PEPPER: env.IDENTITY_PEPPER,
      ATTEMPT_RATE_LIMITER: { limit } as RateLimit,
    }
    const response = await worker.fetch(
      followupCommitRequest(identity, attemptId),
      limitedEnv,
      executionContext,
    )

    expect(response.status).toBe(429)
    expect(limit).toHaveBeenCalledOnce()
  })

  it('enforces session ownership, opaque identifiers and grace expiry', async () => {
    const owner = await createIdentity()
    const stranger = await createIdentity()
    const attemptId = await createMainLockedAttempt(owner)
    const missingSession = await worker.fetch(
      followupCommitRequest({ cookie: '', csrf: owner.csrf }, attemptId),
      env,
      executionContext,
    )
    const strangerResponse = await worker.fetch(
      followupCommitRequest(stranger, attemptId),
      env,
      executionContext,
    )
    const invalidId = await worker.fetch(
      followupCommitRequest(owner, 'not-an-attempt'),
      env,
      executionContext,
    )

    await env.DB.prepare(
      `UPDATE attempts SET grace_end_at = ? WHERE attempt_id = ?`,
    )
      .bind('2026-01-01T00:00:00.000Z', attemptId)
      .run()
    const expired = await worker.fetch(
      followupCommitRequest(owner, attemptId),
      env,
      executionContext,
    )

    expect(missingSession.status).toBe(401)
    expect(strangerResponse.status).toBe(404)
    expect(invalidId.status).toBe(404)
    expect(expired.status).toBe(410)
  })

  it('records explicit debrief completion and resumes the completed projection', async () => {
    const identity = await createIdentity()
    const attemptId = await createMainLockedAttempt(identity)
    await worker.fetch(followupCommitRequest(identity, attemptId), env, executionContext)

    const completed = await worker.fetch(
      debriefCompleteRequest(identity, attemptId),
      env,
      executionContext,
    )
    const completedPayload = await completed.json<{
      data: {
        attempt: {
          attempt_id: string
          state: string
          sequence: number
          debrief_completed_at: string
        }
      }
    }>()
    const stored = await env.DB.prepare(
      `SELECT state, sequence, debrief_completed_at
       FROM attempts WHERE attempt_id = ?`,
    )
      .bind(attemptId)
      .first<{
        state: string
        sequence: number
        debrief_completed_at: string
      }>()
    const resumed = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/attempts/${attemptId}`, {
        headers: { cookie: identity.cookie },
      }),
      env,
      executionContext,
    )
    const resumedPayload = await resumed.json<{
      data: { attempt: Record<string, unknown> }
    }>()

    expect(completed.status).toBe(200)
    expect(completed.headers.get('etag')).toBe('"3"')
    expect(completedPayload.data.attempt).toMatchObject({
      attempt_id: attemptId,
      state: 'debrief_complete',
      sequence: 3,
      debrief_completed_at: expect.stringMatching(/Z$/),
    })
    expect(stored).toEqual({
      state: 'debrief_complete',
      sequence: 3,
      debrief_completed_at:
        completedPayload.data.attempt.debrief_completed_at,
    })
    expect(resumedPayload.data.attempt).toMatchObject(
      completedPayload.data.attempt,
    )
  })

  it('returns the stored completion after a lost response without incrementing twice', async () => {
    const identity = await createIdentity()
    const attemptId = await createMainLockedAttempt(identity)
    await worker.fetch(followupCommitRequest(identity, attemptId), env, executionContext)

    const first = await worker.fetch(
      debriefCompleteRequest(identity, attemptId),
      env,
      executionContext,
    )
    const firstPayload = await first.json<{
      data: { attempt: Record<string, unknown> }
    }>()
    const retry = await worker.fetch(
      debriefCompleteRequest(identity, attemptId),
      env,
      executionContext,
    )
    const retryPayload = await retry.json<{
      data: { attempt: Record<string, unknown> }
    }>()

    expect(first.status).toBe(200)
    expect(retry.status).toBe(200)
    expect(retryPayload.data).toEqual(firstPayload.data)
    expect(retryPayload.data.attempt).toMatchObject({ sequence: 3 })
  })

  it('allows an authorised review to finish after the commitment grace window', async () => {
    const identity = await createIdentity()
    const attemptId = await createMainLockedAttempt(identity)
    await worker.fetch(followupCommitRequest(identity, attemptId), env, executionContext)
    await env.DB.prepare(
      `UPDATE attempts SET grace_end_at = ? WHERE attempt_id = ?`,
    )
      .bind('2026-01-01T00:00:00.000Z', attemptId)
      .run()

    const response = await worker.fetch(
      debriefCompleteRequest(identity, attemptId),
      env,
      executionContext,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        attempt: { state: 'debrief_complete', sequence: 3 },
      },
    })
  })

  it('rejects passive, stale, malformed and unauthorised completion requests', async () => {
    const owner = await createIdentity()
    const stranger = await createIdentity()
    const issuedAttempt = await createMainLockedAttempt(owner)
    const wrongState = await worker.fetch(
      debriefCompleteRequest(owner, issuedAttempt),
      env,
      executionContext,
    )
    await worker.fetch(
      followupCommitRequest(owner, issuedAttempt),
      env,
      executionContext,
    )

    const stale = await worker.fetch(
      debriefCompleteRequest(owner, issuedAttempt, {}, '"1"'),
      env,
      executionContext,
    )
    const malformed = await worker.fetch(
      debriefCompleteRequest(owner, issuedAttempt, { scrolled: true }),
      env,
      executionContext,
    )
    const forbidden = await worker.fetch(
      debriefCompleteRequest(
        { ...owner, csrf: 'x'.repeat(43) },
        issuedAttempt,
      ),
      env,
      executionContext,
    )
    const notOwned = await worker.fetch(
      debriefCompleteRequest(stranger, issuedAttempt),
      env,
      executionContext,
    )

    expect(wrongState.status).toBe(409)
    expect(stale.status).toBe(409)
    expect(malformed.status).toBe(422)
    expect(forbidden.status).toBe(403)
    expect(notOwned.status).toBe(404)
  })

  it('rate-limits debrief completion before changing the attempt', async () => {
    const identity = await createIdentity()
    const attemptId = await createMainLockedAttempt(identity)
    await worker.fetch(followupCommitRequest(identity, attemptId), env, executionContext)
    const limit = vi.fn().mockResolvedValue({ success: false })
    const limitedEnv: Bindings = {
      APP_ENV: env.APP_ENV,
      DB: env.DB,
      IDENTITY_PEPPER: env.IDENTITY_PEPPER,
      ATTEMPT_RATE_LIMITER: { limit } as RateLimit,
    }

    const response = await worker.fetch(
      debriefCompleteRequest(identity, attemptId),
      limitedEnv,
      executionContext,
    )
    const stored = await env.DB.prepare(
      `SELECT state, sequence FROM attempts WHERE attempt_id = ?`,
    )
      .bind(attemptId)
      .first<{ state: string; sequence: number }>()

    expect(response.status).toBe(429)
    expect(limit).toHaveBeenCalledOnce()
    expect(stored).toEqual({ state: 'decision_complete', sequence: 2 })
  })
})
