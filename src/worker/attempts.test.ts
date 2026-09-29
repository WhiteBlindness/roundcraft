import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Bindings } from './bindings'
import worker from './index'

const executionContext = {} as ExecutionContext
const apiOrigin = 'https://roundcraft.test'
const editionId = 'edition_today_001'
const forbiddenMarker = 'SERVER_ONLY_PREFERRED_ACTION_7F3A'

const publicBrief = {
  schemaVersion: 1,
  editionId,
  caseRevision: 'case_revision_today_001',
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

const publicFollowup = {
  schemaVersion: 1,
  caseRevision: 'case_revision_today_001',
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

const publicReveal = {
  schemaVersion: 1,
  caseRevision: 'case_revision_today_001',
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
    method: `Synthetic case reviewed against disclosed state only. ${forbiddenMarker}`,
    sources: [
      { label: 'Roundcraft method', detail: 'Synthetic authored continuation.' },
    ],
  },
  principle:
    'When new information invalidates the route assumption, refresh the decision before committing the remaining time.',
} as const

const serverRubric = {
  schemaVersion: 1,
  caseRevision: 'case_revision_today_001',
  rubricRevision: 'rubric_revision_today_001',
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
    {
      actionId: 'pressure_mid',
      qualifierId: 'paired',
      ratings: { timing: 2, trade: 2 },
      caps: [],
    },
  ],
  evidence: [
    {
      actionId: 'regroup_a',
      evidenceIds: ['bomb_location', 'utility'],
      points: 16,
    },
    {
      actionId: 'pressure_mid',
      evidenceIds: ['bomb_location', 'utility'],
      points: 10,
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

const validMainAnswer = {
  case_revision: 'case_revision_today_001',
  action_id: 'regroup_a',
  qualifier_id: 'quiet',
  evidence_ids: ['bomb_location', 'utility'],
  confidence_id: 'fairly_sure',
} as const

function sessionRequest(cookie?: string) {
  const headers = new Headers({
    'content-type': 'application/json',
    origin: apiOrigin,
    'sec-fetch-site': 'same-origin',
  })

  if (cookie) headers.set('cookie', cookie)

  return new Request(`${apiOrigin}/api/v1/session`, {
    method: 'POST',
    headers,
    body: '{}',
  })
}

function cookiePair(response: Response): string {
  return response.headers.get('set-cookie')?.split(';', 1)[0] ?? ''
}

async function createIdentity(): Promise<{ cookie: string; csrf: string }> {
  const response = await worker.fetch(sessionRequest(), env, executionContext)
  const payload = await response.json<{ data: { csrf_token: string } }>()

  return { cookie: cookiePair(response), csrf: payload.data.csrf_token }
}

function attemptRequest(
  identity: { cookie: string; csrf: string },
  body: unknown = { edition_id: editionId },
): Request {
  return new Request(`${apiOrigin}/api/v1/attempts`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: identity.cookie,
      origin: apiOrigin,
      'sec-fetch-site': 'same-origin',
      'x-csrf-token': identity.csrf,
    },
    body: JSON.stringify(body),
  })
}

function mainCommitRequest(
  identity: { cookie: string; csrf: string },
  attemptId: string,
  body: unknown = validMainAnswer,
  idempotencyKey = '9fd0debf-8f44-4a19-a4e8-a123a1132b24',
  ifMatch = '"0"',
): Request {
  return new Request(`${apiOrigin}/api/v1/attempts/${attemptId}/main-commit`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: identity.cookie,
      origin: apiOrigin,
      'sec-fetch-site': 'same-origin',
      'x-csrf-token': identity.csrf,
      'idempotency-key': idempotencyKey,
      'if-match': ifMatch,
    },
    body: JSON.stringify(body),
  })
}

async function createOfficialAttempt(identity: {
  cookie: string
  csrf: string
}): Promise<string> {
  const response = await worker.fetch(
    attemptRequest(identity),
    env,
    executionContext,
  )
  const payload = await response.json<{
    data: { attempt: { attempt_id: string } }
  }>()

  return payload.data.attempt.attempt_id
}

async function seedReleasedCase(): Promise<void> {
  const createdAt = '2026-09-01T00:00:00.000Z'

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO cases (case_id, origin, created_at)
       VALUES (?, 'synthetic', ?)`,
    ).bind('case_today_001', createdAt),
    env.DB.prepare(
      `INSERT INTO case_revisions (
        case_revision, case_id, schema_version, checksum, status, created_at
      ) VALUES (?, ?, 1, ?, 'locked', ?)`,
    ).bind(
      'case_revision_today_001',
      'case_today_001',
      'checksum_today_001',
      createdAt,
    ),
    env.DB.prepare(
      `INSERT INTO editions (
        edition_id, case_revision, release_at, official_end_at,
        grace_end_at, publication_status, public_metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'released', ?, ?)`,
    ).bind(
      editionId,
      'case_revision_today_001',
      '2026-01-01T00:00:00.000Z',
      '2099-01-01T00:00:00.000Z',
      '2099-01-01T12:00:00.000Z',
      JSON.stringify({
        case_number: 1,
        edition_date_utc: '2026-09-01',
        estimated_minutes: 7,
        focus: 'Information',
        origin_label: 'Synthetic scenario.',
      }),
      createdAt,
    ),
    env.DB.prepare(
      `INSERT INTO case_public_briefs (
        case_revision, payload_json, checksum, created_at
      ) VALUES (?, ?, ?, ?)`,
    ).bind(
      'case_revision_today_001',
      JSON.stringify(publicBrief),
      'public_checksum_today_001',
      createdAt,
    ),
    env.DB.prepare(
      `INSERT INTO case_followups (
        case_revision, payload_json, checksum, created_at
      ) VALUES (?, ?, ?, ?)`,
    ).bind(
      'case_revision_today_001',
      JSON.stringify(publicFollowup),
      'followup_checksum_today_001',
      createdAt,
    ),
    env.DB.prepare(
      `INSERT INTO case_reveals (
        case_revision, payload_json, checksum, created_at
      ) VALUES (?, ?, ?, ?)`,
    ).bind(
      'case_revision_today_001',
      JSON.stringify(publicReveal),
      'reveal_checksum_today_001',
      createdAt,
    ),
    env.DB.prepare(
      `INSERT INTO case_rubrics (
        rubric_revision, case_revision, payload_json, checksum, created_at
      ) VALUES (?, ?, ?, ?, ?)`,
    ).bind(
      'rubric_revision_today_001',
      'case_revision_today_001',
      JSON.stringify(serverRubric),
      'rubric_checksum_today_001',
      createdAt,
    ),
  ])
}

describe('official attempts API', () => {
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
    await seedReleasedCase()
  })

  it('locks one valid main line and only then returns the public follow-up', async () => {
    const identity = await createIdentity()
    const attemptId = await createOfficialAttempt(identity)
    const response = await worker.fetch(
      mainCommitRequest(identity, attemptId),
      env,
      executionContext,
    )
    const text = await response.text()
    const payload = JSON.parse(text)
    const attempt = await env.DB.prepare(
      `SELECT state, sequence, main_committed_at FROM attempts WHERE attempt_id = ?`,
    )
      .bind(attemptId)
      .first<{ state: string; sequence: number; main_committed_at: string }>()
    const commit = await env.DB.prepare(
      `SELECT answer_json, expected_sequence, accepted_sequence
       FROM attempt_commits WHERE attempt_id = ? AND phase = 'main'`,
    )
      .bind(attemptId)
      .first<{ answer_json: string; expected_sequence: number; accepted_sequence: number }>()

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"1"')
    expect(payload.data).toMatchObject({
      attempt: { attempt_id: attemptId, state: 'main_locked', sequence: 1 },
      main_answer: {
        action_id: 'regroup_a',
        qualifier_id: 'quiet',
        evidence_ids: ['bomb_location', 'utility'],
        confidence_id: 'fairly_sure',
      },
      followup: publicFollowup,
    })
    expect(attempt).toMatchObject({ state: 'main_locked', sequence: 1 })
    expect(commit).toMatchObject({ expected_sequence: 0, accepted_sequence: 1 })
    expect(JSON.parse(commit?.answer_json ?? '{}')).toEqual(payload.data.main_answer)
    expect(text).not.toContain(forbiddenMarker)
    expect(text).not.toMatch(/rubric|reveal/i)
  })

  it.each([
    [{ ...validMainAnswer, action_id: 'unknown' }, 'unknown action'],
    [{ ...validMainAnswer, qualifier_id: 'paired' }, 'qualifier from another action'],
    [{ ...validMainAnswer, evidence_ids: ['bomb_location'] }, 'wrong evidence count'],
    [{ ...validMainAnswer, evidence_ids: ['utility', 'utility'] }, 'duplicate evidence'],
    [{ ...validMainAnswer, evidence_ids: ['utility', 'unknown'] }, 'unknown evidence'],
    [{ ...validMainAnswer, confidence_id: 'certain' }, 'unknown confidence'],
  ])('rejects %s (%s) without writing', async (body, _label) => {
    void _label
    const identity = await createIdentity()
    const attemptId = await createOfficialAttempt(identity)
    const response = await worker.fetch(
      mainCommitRequest(identity, attemptId, body),
      env,
      executionContext,
    )
    const count = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM attempt_commits WHERE attempt_id = ?`,
    )
      .bind(attemptId)
      .first<{ count: number }>()

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    })
    expect(count?.count).toBe(0)
  })

  it('returns the identical stored response for the same key and logical body', async () => {
    const identity = await createIdentity()
    const attemptId = await createOfficialAttempt(identity)
    const first = await worker.fetch(
      mainCommitRequest(identity, attemptId),
      env,
      executionContext,
    )
    const second = await worker.fetch(
      mainCommitRequest(identity, attemptId, {
        ...validMainAnswer,
        evidence_ids: ['utility', 'bomb_location'],
      }),
      env,
      executionContext,
    )
    const receiptCount = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM idempotency_receipts WHERE attempt_id = ?`,
    )
      .bind(attemptId)
      .first<{ count: number }>()

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(await second.text()).toBe(await first.text())
    expect(receiptCount?.count).toBe(1)
  })

  it('resumes the authorised locked projection without exposing hidden content', async () => {
    const identity = await createIdentity()
    const attemptId = await createOfficialAttempt(identity)
    await worker.fetch(mainCommitRequest(identity, attemptId), env, executionContext)

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
      attempt: { state: 'main_locked', sequence: 1 },
      main_answer: {
        action_id: validMainAnswer.action_id,
        qualifier_id: validMainAnswer.qualifier_id,
        evidence_ids: validMainAnswer.evidence_ids,
        confidence_id: validMainAnswer.confidence_id,
      },
      followup: publicFollowup,
    })
    expect(text).not.toContain(forbiddenMarker)
    expect(text).not.toMatch(/rubric|reveal/i)
  })

  it('rejects reuse of one key with a different body', async () => {
    const identity = await createIdentity()
    const attemptId = await createOfficialAttempt(identity)
    await worker.fetch(mainCommitRequest(identity, attemptId), env, executionContext)

    const response = await worker.fetch(
      mainCommitRequest(identity, attemptId, {
        ...validMainAnswer,
        confidence_id: 'strong_read',
      }),
      env,
      executionContext,
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: { code: 'IDEMPOTENCY_KEY_REUSED' },
    })
  })

  it('never replaces the winning line when another key submits later', async () => {
    const identity = await createIdentity()
    const attemptId = await createOfficialAttempt(identity)
    await worker.fetch(mainCommitRequest(identity, attemptId), env, executionContext)

    const response = await worker.fetch(
      mainCommitRequest(
        identity,
        attemptId,
        { ...validMainAnswer, action_id: 'pressure_mid', qualifier_id: 'paired' },
        '6f74ce40-4039-4f9e-aef9-f08aab27aef8',
      ),
      env,
      executionContext,
    )
    const stored = await env.DB.prepare(
      `SELECT answer_json FROM attempt_commits WHERE attempt_id = ? AND phase = 'main'`,
    )
      .bind(attemptId)
      .first<{ answer_json: string }>()

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: { code: 'ATTEMPT_STATE_CONFLICT' },
    })
    expect(JSON.parse(stored?.answer_json ?? '{}')).toMatchObject({
      action_id: 'regroup_a',
      qualifier_id: 'quiet',
    })
  })

  it('accepts exactly one branch when different keys race concurrently', async () => {
    const identity = await createIdentity()
    const attemptId = await createOfficialAttempt(identity)
    const [first, second] = await Promise.all([
      worker.fetch(
        mainCommitRequest(identity, attemptId),
        env,
        executionContext,
      ),
      worker.fetch(
        mainCommitRequest(
          identity,
          attemptId,
          { ...validMainAnswer, action_id: 'pressure_mid', qualifier_id: 'paired' },
          '6f74ce40-4039-4f9e-aef9-f08aab27aef8',
        ),
        env,
        executionContext,
      ),
    ])
    const commitCount = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM attempt_commits
       WHERE attempt_id = ? AND phase = 'main'`,
    )
      .bind(attemptId)
      .first<{ count: number }>()

    expect([first.status, second.status].sort()).toEqual([200, 409])
    expect(commitCount?.count).toBe(1)
  })

  it('rejects invalid version and request protection before committing', async () => {
    const identity = await createIdentity()
    const attemptId = await createOfficialAttempt(identity)
    const stale = await worker.fetch(
      mainCommitRequest(identity, attemptId, validMainAnswer, undefined, '"4"'),
      env,
      executionContext,
    )
    const staleRevision = await worker.fetch(
      mainCommitRequest(identity, attemptId, {
        ...validMainAnswer,
        case_revision: 'case_revision_other',
      }),
      env,
      executionContext,
    )
    const forbidden = await worker.fetch(
      mainCommitRequest({ ...identity, csrf: 'x'.repeat(43) }, attemptId),
      env,
      executionContext,
    )

    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({ error: { code: 'VERSION_CONFLICT' } })
    expect(staleRevision.status).toBe(409)
    expect(await staleRevision.json()).toMatchObject({
      error: { code: 'VERSION_CONFLICT' },
    })
    expect(forbidden.status).toBe(403)
  })

  it('creates one opaque official attempt and returns only the public briefing', async () => {
    const identity = await createIdentity()
    const response = await worker.fetch(
      attemptRequest(identity),
      env,
      executionContext,
    )
    const text = await response.text()
    const payload = JSON.parse(text)

    expect(response.status).toBe(200)
    expect(payload.data.attempt).toMatchObject({
      attempt_id: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      edition_id: editionId,
      mode: 'official',
      state: 'issued',
      sequence: 0,
      assisted: false,
    })
    expect(payload.data.brief).toEqual(publicBrief)
    expect(text).not.toContain(forbiddenMarker)
    expect(text).not.toContain('rubric_revision')
  })

  it('returns the same attempt when concurrent creation requests race', async () => {
    const identity = await createIdentity()
    const [first, second] = await Promise.all([
      worker.fetch(attemptRequest(identity), env, executionContext),
      worker.fetch(attemptRequest(identity), env, executionContext),
    ])
    const firstPayload = await first.json<{ data: { attempt: { attempt_id: string } } }>()
    const secondPayload = await second.json<{ data: { attempt: { attempt_id: string } } }>()
    const count = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM attempts
       WHERE edition_id = ? AND mode = 'official'`,
    )
      .bind(editionId)
      .first<{ count: number }>()

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(firstPayload.data.attempt.attempt_id).toBe(
      secondPayload.data.attempt.attempt_id,
    )
    expect(count?.count).toBe(1)
  })

  it('resumes an issued attempt during grace after the start window closes', async () => {
    const identity = await createIdentity()
    const created = await worker.fetch(
      attemptRequest(identity),
      env,
      executionContext,
    )
    const firstPayload = await created.json<{
      data: { attempt: { attempt_id: string } }
    }>()

    await env.DB.prepare(
      `UPDATE editions
       SET official_end_at = '2026-09-01T15:00:00.000Z'
       WHERE edition_id = ?`,
    )
      .bind(editionId)
      .run()

    const resumed = await worker.fetch(
      attemptRequest(identity),
      env,
      executionContext,
    )
    const resumedPayload = await resumed.json<{
      data: { attempt: { attempt_id: string } }
    }>()

    expect(resumed.status).toBe(200)
    expect(resumedPayload.data.attempt.attempt_id).toBe(
      firstPayload.data.attempt.attempt_id,
    )
  })

  it('rejects missing sessions and invalid CSRF before writing', async () => {
    const identity = await createIdentity()
    const missingSession = attemptRequest({ cookie: '', csrf: identity.csrf })
    const invalidCsrf = attemptRequest({ ...identity, csrf: 'x'.repeat(43) })

    const first = await worker.fetch(missingSession, env, executionContext)
    const second = await worker.fetch(invalidCsrf, env, executionContext)
    const count = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM attempts',
    ).first<{ count: number }>()

    expect(first.status).toBe(401)
    expect(second.status).toBe(403)
    expect(count?.count).toBe(0)
  })

  it('rejects malformed input without selecting another edition', async () => {
    const identity = await createIdentity()
    const response = await worker.fetch(
      attemptRequest(identity, { edition_id: '../other', extra: true }),
      env,
      executionContext,
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    })
  })

  it('allows only the owner to resume an attempt and uses a neutral 404', async () => {
    const owner = await createIdentity()
    const stranger = await createIdentity()
    const created = await worker.fetch(
      attemptRequest(owner),
      env,
      executionContext,
    )
    const createdPayload = await created.json<{
      data: { attempt: { attempt_id: string } }
    }>()
    const attemptId = createdPayload.data.attempt.attempt_id
    const ownerResponse = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/attempts/${attemptId}`, {
        headers: { cookie: owner.cookie },
      }),
      env,
      executionContext,
    )
    const strangerResponse = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/attempts/${attemptId}`, {
        headers: { cookie: stranger.cookie },
      }),
      env,
      executionContext,
    )
    const missingResponse = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/attempts/${'z'.repeat(43)}`, {
        headers: { cookie: owner.cookie },
      }),
      env,
      executionContext,
    )

    expect(ownerResponse.status).toBe(200)
    expect(strangerResponse.status).toBe(404)
    expect(missingResponse.status).toBe(404)
    expect(await strangerResponse.json()).toMatchObject({
      ok: false,
      data: null,
      error: {
        code: 'ATTEMPT_NOT_FOUND',
        message: 'The attempt is unavailable.',
      },
    })
    expect(await missingResponse.json()).toMatchObject({
      ok: false,
      data: null,
      error: {
        code: 'ATTEMPT_NOT_FOUND',
        message: 'The attempt is unavailable.',
      },
    })
  })

  it('returns a safe gone state for an owned attempt after grace expires', async () => {
    const identity = await createIdentity()
    const created = await worker.fetch(
      attemptRequest(identity),
      env,
      executionContext,
    )
    const payload = await created.json<{
      data: { attempt: { attempt_id: string } }
    }>()

    await env.DB.prepare(
      `UPDATE attempts
       SET grace_end_at = '2026-01-01T00:00:00.000Z'
       WHERE attempt_id = ?`,
    )
      .bind(payload.data.attempt.attempt_id)
      .run()

    const response = await worker.fetch(
      new Request(
        `${apiOrigin}/api/v1/attempts/${payload.data.attempt.attempt_id}`,
        { headers: { cookie: identity.cookie } },
      ),
      env,
      executionContext,
    )

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({
      error: { code: 'ATTEMPT_EXPIRED' },
    })
  })

  it('rate-limits attempt creation before reading or writing D1', async () => {
    const identity = await createIdentity()
    const limit = vi.fn().mockResolvedValue({ success: false })
    const limitedEnv: Bindings = {
      APP_ENV: env.APP_ENV,
      DB: env.DB,
      IDENTITY_PEPPER: env.IDENTITY_PEPPER,
      ATTEMPT_RATE_LIMITER: { limit } as RateLimit,
    }
    const response = await worker.fetch(
      attemptRequest(identity),
      limitedEnv,
      executionContext,
    )
    const count = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM attempts',
    ).first<{ count: number }>()

    expect(response.status).toBe(429)
    expect(limit).toHaveBeenCalledOnce()
    expect(count?.count).toBe(0)
  })

  it('rate-limits a main commitment before writing D1', async () => {
    const identity = await createIdentity()
    const attemptId = await createOfficialAttempt(identity)
    const limit = vi.fn().mockResolvedValue({ success: false })
    const limitedEnv: Bindings = {
      APP_ENV: env.APP_ENV,
      DB: env.DB,
      IDENTITY_PEPPER: env.IDENTITY_PEPPER,
      ATTEMPT_RATE_LIMITER: { limit } as RateLimit,
    }
    const response = await worker.fetch(
      mainCommitRequest(identity, attemptId),
      limitedEnv,
      executionContext,
    )
    const count = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM attempt_commits WHERE attempt_id = ?`,
    )
      .bind(attemptId)
      .first<{ count: number }>()

    expect(response.status).toBe(429)
    expect(limit).toHaveBeenCalledOnce()
    expect(count?.count).toBe(0)
  })
})

function practiceRequest(identity: { cookie: string; csrf: string }): Request {
  return new Request(`${apiOrigin}/api/v1/practice-attempts`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: identity.cookie,
      origin: apiOrigin,
      'sec-fetch-site': 'same-origin',
      'x-csrf-token': identity.csrf,
    },
    body: JSON.stringify({ edition_id: editionId }),
  })
}

async function resetAll(): Promise<void> {
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
}

async function setRevisionStatus(status: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE case_revisions SET status = ? WHERE case_revision = ?`,
  )
    .bind(status, 'case_revision_today_001')
    .run()
}

describe('playable revision rule', () => {
  beforeEach(async () => {
    await resetAll()
    await seedReleasedCase()
  })

  it.each(['draft', 'approved'])(
    'does not advertise or start a %s revision on any route',
    async (status) => {
      await setRevisionStatus(status)
      const identity = await createIdentity()

      const today = await worker.fetch(
        new Request(`${apiOrigin}/api/v1/today`),
        env,
        executionContext,
      )
      const cases = await worker.fetch(
        new Request(`${apiOrigin}/api/v1/cases`),
        env,
        executionContext,
      )
      const official = await worker.fetch(
        attemptRequest(identity),
        env,
        executionContext,
      )
      const practice = await worker.fetch(
        practiceRequest(identity),
        env,
        executionContext,
      )
      const attemptCount = await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM attempts`,
      ).first<{ count: number }>()

      expect((await today.json<{ data: unknown }>()).data).toMatchObject({
        availability: 'unavailable',
        edition: null,
      })
      expect(
        (await cases.json<{ data: { editions: unknown[] } }>()).data.editions,
      ).toEqual([])
      expect(official.status).toBe(404)
      expect(await official.json()).toMatchObject({
        error: { code: 'NO_CURRENT_EDITION' },
      })
      expect(practice.status).toBe(404)
      expect(attemptCount?.count).toBe(0)
    },
  )

  it('advertises and starts a locked, released revision', async () => {
    const identity = await createIdentity()

    const today = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/today`),
      env,
      executionContext,
    )
    const cases = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/cases`),
      env,
      executionContext,
    )
    const official = await worker.fetch(
      attemptRequest(identity),
      env,
      executionContext,
    )
    const practice = await worker.fetch(
      practiceRequest(identity),
      env,
      executionContext,
    )

    expect(
      (await today.json<{ data: { edition: { edition_id: string } } }>()).data
        .edition.edition_id,
    ).toBe(editionId)
    expect(
      (
        await cases.json<{
          data: { editions: Array<{ edition_id: string }> }
        }>()
      ).data.editions.map(({ edition_id }) => edition_id),
    ).toEqual([editionId])
    expect(official.status).toBe(200)
    expect(practice.status).toBe(200)
  })

  it('keeps an existing attempt resumable if its revision later leaves locked', async () => {
    const identity = await createIdentity()
    const attemptId = await createOfficialAttempt(identity)
    await setRevisionStatus('approved')

    const resumed = await worker.fetch(
      attemptRequest(identity),
      env,
      executionContext,
    )
    const read = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/attempts/${attemptId}`, {
        headers: { cookie: identity.cookie },
      }),
      env,
      executionContext,
    )
    const commit = await worker.fetch(
      mainCommitRequest(identity, attemptId),
      env,
      executionContext,
    )

    expect(resumed.status).toBe(200)
    expect(read.status).toBe(200)
    expect(commit.status).toBe(200)
  })
})

describe('main commit rubric coverage', () => {
  const uncoveredAnswer = {
    ...validMainAnswer,
    evidence_ids: ['clock', 'spacing'],
  } as const
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    await resetAll()
    await seedReleasedCase()
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function attemptRow(attemptId: string) {
    return env.DB.prepare(
      `SELECT state, sequence, main_committed_at FROM attempts WHERE attempt_id = ?`,
    )
      .bind(attemptId)
      .first<{
        state: string
        sequence: number
        main_committed_at: string | null
      }>()
  }

  async function commitAndReceiptCounts(attemptId: string) {
    const commits = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM attempt_commits WHERE attempt_id = ?`,
    )
      .bind(attemptId)
      .first<{ count: number }>()
    const receipts = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM idempotency_receipts WHERE attempt_id = ?`,
    )
      .bind(attemptId)
      .first<{ count: number }>()

    return { commits: commits?.count, receipts: receipts?.count }
  }

  function loggedEvents(): Array<Record<string, unknown>> {
    return errorSpy.mock.calls.map(
      ([line]: unknown[]) => JSON.parse(String(line)) as Record<string, unknown>,
    )
  }

  it('refuses to lock a published pair the rubric cannot score, then locks once fixed', async () => {
    const identity = await createIdentity()
    const attemptId = await createOfficialAttempt(identity)

    const response = await worker.fetch(
      mainCommitRequest(identity, attemptId, uncoveredAnswer),
      env,
      executionContext,
    )
    const text = await response.text()
    const payload = JSON.parse(text) as {
      error: { code: string }
      meta: { request_id: string }
    }
    const rejected = loggedEvents().find(
      ({ event }) => event === 'main_commit_rubric_rejected',
    )

    expect(response.status).toBe(503)
    expect(payload.error.code).toBe('SERVICE_UNAVAILABLE')
    expect(text).not.toContain('rubric')
    expect(text).not.toContain('timing')
    expect(await attemptRow(attemptId)).toMatchObject({
      state: 'issued',
      sequence: 0,
      main_committed_at: null,
    })
    expect(await commitAndReceiptCounts(attemptId)).toEqual({
      commits: 0,
      receipts: 0,
    })
    expect(rejected).toMatchObject({
      level: 'error',
      request_id: payload.meta.request_id,
      route: 'POST /api/v1/attempts/:attemptId/main-commit',
      edition_id: editionId,
      reason: 'not_covered',
    })
    expect(JSON.stringify(loggedEvents())).not.toContain('clock')
    expect(JSON.stringify(loggedEvents())).not.toContain(identity.cookie)

    await env.DB.prepare(
      `UPDATE case_rubrics SET payload_json = ? WHERE rubric_revision = ?`,
    )
      .bind(
        JSON.stringify({
          ...serverRubric,
          evidence: [
            ...serverRubric.evidence,
            {
              actionId: 'regroup_a',
              evidenceIds: ['clock', 'spacing'],
              points: 4,
            },
          ],
        }),
        'rubric_revision_today_001',
      )
      .run()

    const retry = await worker.fetch(
      mainCommitRequest(identity, attemptId, uncoveredAnswer),
      env,
      executionContext,
    )

    expect(retry.status).toBe(200)
    expect(await attemptRow(attemptId)).toMatchObject({
      state: 'main_locked',
      sequence: 1,
    })
  })

  it.each([
    ['unparseable', 'invalid', '{"schemaVersion":1}'],
    [
      'for another revision',
      'revision_mismatch',
      JSON.stringify({ ...serverRubric, caseRevision: 'some_other_revision' }),
    ],
  ])(
    'refuses to lock when the rubric is %s',
    async (_label, reason, payloadJson) => {
      await env.DB.prepare(
        `UPDATE case_rubrics SET payload_json = ? WHERE rubric_revision = ?`,
      )
        .bind(payloadJson, 'rubric_revision_today_001')
        .run()
      const identity = await createIdentity()
      const attemptId = await createOfficialAttempt(identity)

      const response = await worker.fetch(
        mainCommitRequest(identity, attemptId),
        env,
        executionContext,
      )

      expect(response.status).toBe(503)
      expect(await attemptRow(attemptId)).toMatchObject({
        state: 'issued',
        sequence: 0,
      })
      expect(await commitAndReceiptCounts(attemptId)).toEqual({
        commits: 0,
        receipts: 0,
      })
      expect(loggedEvents()).toContainEqual(
        expect.objectContaining({
          event: 'main_commit_rubric_rejected',
          reason,
        }),
      )
    },
  )

  it('still replays a stored receipt without re-checking the rubric', async () => {
    const identity = await createIdentity()
    const attemptId = await createOfficialAttempt(identity)
    const first = await worker.fetch(
      mainCommitRequest(identity, attemptId),
      env,
      executionContext,
    )
    await env.DB.prepare(
      `UPDATE case_rubrics SET payload_json = '{}' WHERE rubric_revision = ?`,
    )
      .bind('rubric_revision_today_001')
      .run()

    const replay = await worker.fetch(
      mainCommitRequest(identity, attemptId),
      env,
      executionContext,
    )

    expect(first.status).toBe(200)
    expect(replay.status).toBe(200)
    expect(await replay.text()).toBe(await first.text())
    expect(
      loggedEvents().some(({ event }) => event === 'main_commit_rubric_rejected'),
    ).toBe(false)
  })

  it('logs idempotency key reuse and state conflicts without answers or identifiers', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const identity = await createIdentity()
    const attemptId = await createOfficialAttempt(identity)
    await worker.fetch(
      mainCommitRequest(identity, attemptId),
      env,
      executionContext,
    )

    const reused = await worker.fetch(
      mainCommitRequest(identity, attemptId, {
        ...validMainAnswer,
        confidence_id: 'guessing',
      }),
      env,
      executionContext,
    )
    const conflict = await worker.fetch(
      mainCommitRequest(
        identity,
        attemptId,
        validMainAnswer,
        '6f74ce40-4039-4f9e-aef9-f08aab27aef8',
        '"1"',
      ),
      env,
      executionContext,
    )
    const output = warnSpy.mock.calls.map(([line]) => String(line))

    expect(reused.status).toBe(409)
    expect(conflict.status).toBe(409)
    expect(output.map((line) => JSON.parse(line).event)).toEqual([
      'idempotency_key_reused',
      'attempt_state_conflict',
    ])
    expect(output.join('\n')).not.toContain(attemptId)
    expect(output.join('\n')).not.toContain(identity.cookie)
    expect(output.join('\n')).not.toContain('fairly_sure')
  })
})
