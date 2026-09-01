import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
      JSON.stringify({ hidden: forbiddenMarker }),
      'followup_checksum_today_001',
      createdAt,
    ),
    env.DB.prepare(
      `INSERT INTO case_reveals (
        case_revision, payload_json, checksum, created_at
      ) VALUES (?, ?, ?, ?)`,
    ).bind(
      'case_revision_today_001',
      JSON.stringify({ hidden: forbiddenMarker }),
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
      JSON.stringify({ preferredAction: forbiddenMarker }),
      'rubric_checksum_today_001',
      createdAt,
    ),
  ])
}

describe('official attempts API', () => {
  beforeEach(async () => {
    await env.DB.exec(
      `DELETE FROM attempts;
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
})
