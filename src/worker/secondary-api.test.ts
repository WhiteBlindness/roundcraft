import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

import worker from './index'

const executionContext = {} as ExecutionContext
const apiOrigin = 'https://roundcraft.test'

function cookiePair(setCookie: string) {
  return setCookie.split(';', 1)[0] ?? ''
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
  const payload = await response.json<{
    data: { csrf_token: string; identity_expires_at: string }
  }>()
  const cookie = cookiePair(response.headers.get('set-cookie') ?? '')
  return { cookie, csrfToken: payload.data.csrf_token }
}

function authenticatedGet(path: string, cookie: string) {
  return new Request(`${apiOrigin}${path}`, {
    method: 'GET',
    headers: { cookie },
  })
}

function authenticatedPost(
  path: string,
  cookie: string,
  csrfToken: string,
  body: unknown,
) {
  const bodyString = JSON.stringify(body)
  return new Request(`${apiOrigin}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': String(new TextEncoder().encode(bodyString).length),
      origin: apiOrigin,
      'sec-fetch-site': 'same-origin',
      'x-csrf-token': csrfToken,
      cookie,
    },
    body: bodyString,
  })
}

function authenticatedDelete(
  path: string,
  cookie: string,
  csrfToken: string,
) {
  return new Request(`${apiOrigin}${path}`, {
    method: 'DELETE',
    headers: {
      'content-type': 'application/json',
      'content-length': '2',
      origin: apiOrigin,
      'sec-fetch-site': 'same-origin',
      'x-csrf-token': csrfToken,
      cookie,
    },
    body: '{}',
  })
}

const briefPayload = JSON.stringify({
  schemaVersion: 1,
  editionId: 'edition_sec_001',
  caseRevision: 'case_revision_sec_001',
  title: 'Test brief',
  focus: 'Test focus',
  origin: 'synthetic',
  facts: [
    { id: 'f1', status: 'confirmed', text: 'Fact one.' },
  ],
  actions: [
    { id: 'a', label: 'Action A', qualifierIds: ['q1', 'q2'] },
    { id: 'b', label: 'Action B', qualifierIds: ['q1', 'q2'] },
    { id: 'c', label: 'Action C', qualifierIds: ['q1', 'q2'] },
  ],
  qualifiers: [
    { id: 'q1', label: 'Quietly' },
    { id: 'q2', label: 'Immediately' },
  ],
  evidence: [
    { id: 'e1', label: 'Evidence 1' },
    { id: 'e2', label: 'Evidence 2' },
    { id: 'e3', label: 'Evidence 3' },
    { id: 'e4', label: 'Evidence 4' },
    { id: 'e5', label: 'Evidence 5' },
  ],
  confidence: [
    { id: 'guessing', label: 'Guessing' },
    { id: 'leaning', label: 'Leaning' },
    { id: 'fairly_sure', label: 'Fairly sure' },
    { id: 'strong_read', label: 'Strong read' },
  ],
})

async function seedEditionWithBrief() {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO cases (case_id, origin, created_at)
       VALUES (?, 'synthetic', ?)`,
    ).bind('case_sec_001', '2026-09-01T00:00:00.000Z'),
    env.DB.prepare(
      `INSERT INTO case_revisions (
        case_revision, case_id, schema_version, checksum, status, created_at
      ) VALUES (?, ?, 1, ?, 'locked', ?)`,
    ).bind(
      'case_revision_sec_001',
      'case_sec_001',
      'checksum_sec_001',
      '2026-09-01T00:00:00.000Z',
    ),
    env.DB.prepare(
      `INSERT INTO editions (
        edition_id, case_revision, release_at, official_end_at,
        grace_end_at, publication_status, public_metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'released', ?, ?)`,
    ).bind(
      'edition_sec_001',
      'case_revision_sec_001',
      '2026-01-01T00:00:00.000Z',
      '2099-01-01T00:00:00.000Z',
      '2099-01-01T12:00:00.000Z',
      JSON.stringify({
        case_number: 1,
        edition_date_utc: '2026-09-01',
        estimated_minutes: 7,
        focus: 'Information',
        origin_label: 'Synthetic test scenario.',
      }),
      '2026-09-01T00:00:00.000Z',
    ),
    env.DB.prepare(
      `INSERT INTO case_public_briefs (
        case_revision, payload_json, checksum, created_at
      ) VALUES (?, ?, ?, ?)`,
    ).bind(
      'case_revision_sec_001',
      briefPayload,
      'brief_checksum_sec_001',
      '2026-09-01T00:00:00.000Z',
    ),
    env.DB.prepare(
      `INSERT INTO case_rubrics (
        rubric_revision, case_revision, payload_json, checksum, created_at
      ) VALUES (?, ?, ?, ?, ?)`,
    ).bind(
      'rubric_sec_001',
      'case_revision_sec_001',
      JSON.stringify({ version: 1 }),
      'rubric_checksum_sec_001',
      '2026-09-01T00:00:00.000Z',
    ),
  ])
}

async function seedAttemptWithResult(identityId: string) {
  const attemptId = 'attempt_sec_001_aaaaaaaaaaaaaaaaaaaaaaaaaaa'
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO attempts (
        attempt_id, identity_id, edition_id, case_revision, rubric_revision,
        ruleset_revision, mode, state, sequence, assisted, issued_at,
        grace_end_at, debrief_completed_at
      ) VALUES (?, ?, 'edition_sec_001', 'case_revision_sec_001',
        'rubric_sec_001', 'ruleset_v1', 'official', 'debrief_complete',
        3, 0, ?, '2099-01-01T12:00:00.000Z', ?)`,
    ).bind(
      attemptId,
      identityId,
      '2026-09-01T14:00:00.000Z',
      '2026-09-01T14:10:00.000Z',
    ),
    env.DB.prepare(
      `INSERT INTO result_versions (
        result_version_id, attempt_id, version, status,
        quality_quarter_units, evidence_points, followup_quality,
        exact_total_units, total_score, display_main, display_evidence,
        display_followup, created_at
      ) VALUES (?, ?, 1, 'scored', 300, 16, 80, 8900, 89, 45, 16, 28, ?)`,
    ).bind(
      'rv_sec_001',
      attemptId,
      '2026-09-01T14:10:00.000Z',
    ),
    env.DB.prepare(
      `INSERT INTO participation_credits (
        identity_id, edition_id, attempt_id, awarded_at, status
      ) VALUES (?, 'edition_sec_001', ?, ?, 'awarded')`,
    ).bind(
      identityId,
      attemptId,
      '2026-09-01T14:10:00.000Z',
    ),
  ])
  return attemptId
}

async function getIdentityId(cookie: string): Promise<string> {
  const [, token] = cookie.split('=', 2)
  const pepper = env.IDENTITY_PEPPER!
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`identity:${token}`),
  )
  let binary = ''
  for (const byte of new Uint8Array(signature)) {
    binary += String.fromCharCode(byte)
  }
  const verifier = btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')

  const row = await env.DB.prepare(
    'SELECT identity_id FROM anonymous_identities WHERE token_verifier = ?',
  )
    .bind(verifier)
    .first<{ identity_id: string }>()

  return row!.identity_id
}

describe('Today API — authenticated status and edge cases', () => {
  beforeEach(async () => {
    await env.DB.exec(
      `DELETE FROM analytics_events;
       DELETE FROM fairness_reports;
       DELETE FROM participation_credits;
       DELETE FROM result_versions;
       DELETE FROM idempotency_receipts;
       DELETE FROM attempt_commits;
       DELETE FROM attempts;
       DELETE FROM anonymous_identities;
       DELETE FROM case_rubrics;
       DELETE FROM case_public_briefs;
       DELETE FROM editions;
       DELETE FROM case_revisions;
       DELETE FROM cases;`,
    )
  })

  it('returns 304 when the If-None-Match header matches the ETag', async () => {
    const first = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/today`),
      env,
      executionContext,
    )
    const etag = first.headers.get('etag')!
    expect(etag).toBeTruthy()

    const second = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/today`, {
        headers: { 'if-none-match': etag },
      }),
      env,
      executionContext,
    )

    expect(second.status).toBe(304)
  })

  it('shows in_progress status for an authenticated user with an issued attempt', async () => {
    await seedEditionWithBrief()
    const { cookie } = await createIdentity()
    const identityId = await getIdentityId(cookie)

    await env.DB.prepare(
      `INSERT INTO attempts (
        attempt_id, identity_id, edition_id, case_revision, rubric_revision,
        ruleset_revision, mode, state, sequence, assisted, issued_at, grace_end_at
      ) VALUES (?, ?, 'edition_sec_001', 'case_revision_sec_001',
        'rubric_sec_001', 'ruleset_v1', 'official', 'issued',
        0, 0, ?, '2099-01-01T12:00:00.000Z')`,
    )
      .bind(
        'in_progress_attempt_aaaaaaaaaaaaaaaaaaaaaaa',
        identityId,
        '2026-09-01T14:00:00.000Z',
      )
      .run()

    const response = await worker.fetch(
      authenticatedGet('/api/v1/today', cookie),
      env,
      executionContext,
    )

    expect(response.status).toBe(200)
    const payload = await response.json<{
      data: { edition: { status: string; primary_action: string } }
    }>()
    expect(payload.data.edition.status).toBe('in_progress')
    expect(payload.data.edition.primary_action).toBe('continue')
  })

  it('shows decision_complete status when the attempt reached that state', async () => {
    await seedEditionWithBrief()
    const { cookie } = await createIdentity()
    const identityId = await getIdentityId(cookie)

    await env.DB.prepare(
      `INSERT INTO attempts (
        attempt_id, identity_id, edition_id, case_revision, rubric_revision,
        ruleset_revision, mode, state, sequence, assisted, issued_at, grace_end_at
      ) VALUES (?, ?, 'edition_sec_001', 'case_revision_sec_001',
        'rubric_sec_001', 'ruleset_v1', 'official', 'decision_complete',
        2, 0, ?, '2099-01-01T12:00:00.000Z')`,
    )
      .bind(
        'decision_complete_attempt_aaaaaaaaaaaaaaaaa',
        identityId,
        '2026-09-01T14:00:00.000Z',
      )
      .run()

    const response = await worker.fetch(
      authenticatedGet('/api/v1/today', cookie),
      env,
      executionContext,
    )

    expect(response.status).toBe(200)
    const payload = await response.json<{
      data: { edition: { status: string; primary_action: string } }
    }>()
    expect(payload.data.edition.status).toBe('decision_complete')
    expect(payload.data.edition.primary_action).toBe('view_debrief')
  })

  it('shows complete status when the attempt reached debrief_complete', async () => {
    await seedEditionWithBrief()
    const { cookie } = await createIdentity()
    const identityId = await getIdentityId(cookie)

    await env.DB.prepare(
      `INSERT INTO attempts (
        attempt_id, identity_id, edition_id, case_revision, rubric_revision,
        ruleset_revision, mode, state, sequence, assisted, issued_at,
        grace_end_at, debrief_completed_at
      ) VALUES (?, ?, 'edition_sec_001', 'case_revision_sec_001',
        'rubric_sec_001', 'ruleset_v1', 'official', 'debrief_complete',
        3, 0, ?, '2099-01-01T12:00:00.000Z', ?)`,
    )
      .bind(
        'debrief_complete_attempt_aaaaaaaaaaaaaaaaaa',
        identityId,
        '2026-09-01T14:00:00.000Z',
        '2026-09-01T14:10:00.000Z',
      )
      .run()

    const response = await worker.fetch(
      authenticatedGet('/api/v1/today', cookie),
      env,
      executionContext,
    )

    expect(response.status).toBe(200)
    const payload = await response.json<{
      data: { edition: { status: string; primary_action: string } }
    }>()
    expect(payload.data.edition.status).toBe('complete')
    expect(payload.data.edition.primary_action).toBe('review')
  })

  it('returns 503 when public_metadata_json is not valid JSON', async () => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO cases (case_id, origin, created_at)
         VALUES ('case_bad_json', 'synthetic', '2026-09-01T00:00:00.000Z')`,
      ),
      env.DB.prepare(
        `INSERT INTO case_revisions (
          case_revision, case_id, schema_version, checksum, status, created_at
        ) VALUES ('cr_bad_json', 'case_bad_json', 1, 'ck_bad_json', 'locked', '2026-09-01T00:00:00.000Z')`,
      ),
      env.DB.prepare(
        `INSERT INTO editions (
          edition_id, case_revision, release_at, official_end_at,
          grace_end_at, publication_status, public_metadata_json, created_at
        ) VALUES ('edition_bad_json', 'cr_bad_json', '2026-01-01T00:00:00.000Z',
          '2099-01-01T00:00:00.000Z', '2099-01-01T12:00:00.000Z', 'released',
          '{"valid": true}', '2026-09-01T00:00:00.000Z')`,
      ),
    ])
    // The JSON is valid but doesn't match the publicMetadataSchema (missing required fields)
    const response = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/today`),
      env,
      executionContext,
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      error: { code: 'SERVICE_UNAVAILABLE' },
    })
  })

  it('shows main_locked as in_progress', async () => {
    await seedEditionWithBrief()
    const { cookie } = await createIdentity()
    const identityId = await getIdentityId(cookie)

    await env.DB.prepare(
      `INSERT INTO attempts (
        attempt_id, identity_id, edition_id, case_revision, rubric_revision,
        ruleset_revision, mode, state, sequence, assisted, issued_at, grace_end_at
      ) VALUES (?, ?, 'edition_sec_001', 'case_revision_sec_001',
        'rubric_sec_001', 'ruleset_v1', 'official', 'main_locked',
        1, 0, ?, '2099-01-01T12:00:00.000Z')`,
    )
      .bind(
        'main_locked_attempt_aaaaaaaaaaaaaaaaaaaaaaa',
        identityId,
        '2026-09-01T14:00:00.000Z',
      )
      .run()

    const response = await worker.fetch(
      authenticatedGet('/api/v1/today', cookie),
      env,
      executionContext,
    )

    expect(response.status).toBe(200)
    const payload = await response.json<{
      data: { edition: { status: string; primary_action: string } }
    }>()
    expect(payload.data.edition.status).toBe('in_progress')
    expect(payload.data.edition.primary_action).toBe('continue')
  })
})

describe('cases API', () => {
  beforeEach(async () => {
    await env.DB.exec(
      `DELETE FROM analytics_events;
       DELETE FROM fairness_reports;
       DELETE FROM participation_credits;
       DELETE FROM result_versions;
       DELETE FROM idempotency_receipts;
       DELETE FROM attempt_commits;
       DELETE FROM attempts;
       DELETE FROM anonymous_identities;
       DELETE FROM case_rubrics;
       DELETE FROM case_public_briefs;
       DELETE FROM editions;
       DELETE FROM case_revisions;
       DELETE FROM cases;`,
    )
  })

  it('returns an empty list when no editions exist', async () => {
    const response = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/cases`),
      env,
      executionContext,
    )

    expect(response.status).toBe(200)
    const payload = await response.json<{
      data: { editions: unknown[]; next_cursor: string | null }
    }>()
    expect(payload.data.editions).toEqual([])
    expect(payload.data.next_cursor).toBeNull()
  })

  it('returns released editions with metadata', async () => {
    await seedEditionWithBrief()

    const response = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/cases`),
      env,
      executionContext,
    )

    expect(response.status).toBe(200)
    const payload = await response.json<{
      data: { editions: Array<{ edition_id: string }>; next_cursor: string | null }
    }>()
    expect(payload.data.editions).toHaveLength(1)
    expect(payload.data.editions[0]!.edition_id).toBe('edition_sec_001')
    expect(payload.data.next_cursor).toBeNull()
  })

  it('respects the limit parameter', async () => {
    await seedEditionWithBrief()

    const response = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/cases?limit=1`),
      env,
      executionContext,
    )

    expect(response.status).toBe(200)
    const payload = await response.json<{
      data: { editions: unknown[]; next_cursor: string | null }
    }>()
    expect(payload.data.editions).toHaveLength(1)
  })
})

describe('progress API', () => {
  beforeEach(async () => {
    await env.DB.exec(
      `DELETE FROM analytics_events;
       DELETE FROM fairness_reports;
       DELETE FROM participation_credits;
       DELETE FROM result_versions;
       DELETE FROM idempotency_receipts;
       DELETE FROM attempt_commits;
       DELETE FROM attempts;
       DELETE FROM anonymous_identities;
       DELETE FROM case_rubrics;
       DELETE FROM case_public_briefs;
       DELETE FROM editions;
       DELETE FROM case_revisions;
       DELETE FROM cases;`,
    )
  })

  it('rejects unauthenticated requests', async () => {
    const response = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/progress`),
      env,
      executionContext,
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      error: { code: 'SESSION_INVALID' },
    })
  })

  it('returns empty entries when the identity has no completed attempts', async () => {
    const { cookie } = await createIdentity()

    const response = await worker.fetch(
      authenticatedGet('/api/v1/progress', cookie),
      env,
      executionContext,
    )

    expect(response.status).toBe(200)
    const payload = await response.json<{
      data: { entries: unknown[] }
    }>()
    expect(payload.data.entries).toEqual([])
  })

  it('returns scored entries for completed attempts', async () => {
    await seedEditionWithBrief()
    const { cookie } = await createIdentity()
    const identityId = await getIdentityId(cookie)
    await seedAttemptWithResult(identityId)

    const response = await worker.fetch(
      authenticatedGet('/api/v1/progress', cookie),
      env,
      executionContext,
    )

    expect(response.status).toBe(200)
    const payload = await response.json<{
      data: {
        entries: Array<{
          edition_id: string
          total_score: number
          display_main: number
          display_evidence: number
          display_followup: number
        }>
      }
    }>()
    expect(payload.data.entries).toHaveLength(1)
    expect(payload.data.entries[0]).toMatchObject({
      edition_id: 'edition_sec_001',
      total_score: 89,
      display_main: 45,
      display_evidence: 16,
      display_followup: 28,
    })
  })
})

describe('history deletion API', () => {
  beforeEach(async () => {
    await env.DB.exec(
      `DELETE FROM analytics_events;
       DELETE FROM fairness_reports;
       DELETE FROM participation_credits;
       DELETE FROM result_versions;
       DELETE FROM idempotency_receipts;
       DELETE FROM attempt_commits;
       DELETE FROM attempts;
       DELETE FROM anonymous_identities;
       DELETE FROM case_rubrics;
       DELETE FROM case_public_briefs;
       DELETE FROM editions;
       DELETE FROM case_revisions;
       DELETE FROM cases;`,
    )
  })

  it('rejects unauthenticated requests', async () => {
    const response = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/history`, { method: 'DELETE' }),
      env,
      executionContext,
    )

    expect(response.status).toBe(401)
  })

  it('rejects requests without CSRF token', async () => {
    const { cookie } = await createIdentity()

    const response = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/history`, {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          'content-length': '2',
          origin: apiOrigin,
          'sec-fetch-site': 'same-origin',
          cookie,
        },
        body: '{}',
      }),
      env,
      executionContext,
    )

    expect(response.status).toBe(403)
  })

  it('deletes attempts and marks the identity as deleted', async () => {
    await seedEditionWithBrief()
    const { cookie, csrfToken } = await createIdentity()
    const identityId = await getIdentityId(cookie)
    await seedAttemptWithResult(identityId)

    const response = await worker.fetch(
      authenticatedDelete('/api/v1/history', cookie, csrfToken),
      env,
      executionContext,
    )

    expect(response.status).toBe(200)
    const payload = await response.json<{ data: { deleted: boolean } }>()
    expect(payload.data.deleted).toBe(true)

    const attemptCount = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM attempts WHERE identity_id = ?',
    )
      .bind(identityId)
      .first<{ count: number }>()
    expect(attemptCount?.count).toBe(0)

    const identity = await env.DB.prepare(
      'SELECT status FROM anonymous_identities WHERE identity_id = ?',
    )
      .bind(identityId)
      .first<{ status: string }>()
    expect(identity?.status).toBe('deleted')
  })
})

describe('events API', () => {
  beforeEach(async () => {
    await env.DB.exec(
      `DELETE FROM analytics_events;
       DELETE FROM fairness_reports;
       DELETE FROM participation_credits;
       DELETE FROM result_versions;
       DELETE FROM idempotency_receipts;
       DELETE FROM attempt_commits;
       DELETE FROM attempts;
       DELETE FROM anonymous_identities;
       DELETE FROM case_rubrics;
       DELETE FROM case_public_briefs;
       DELETE FROM editions;
       DELETE FROM case_revisions;
       DELETE FROM cases;`,
    )
  })

  it('rejects unauthenticated requests', async () => {
    const response = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      env,
      executionContext,
    )

    expect(response.status).toBe(401)
  })

  it('records a valid analytics event', async () => {
    const { cookie, csrfToken } = await createIdentity()

    const response = await worker.fetch(
      authenticatedPost('/api/v1/events', cookie, csrfToken, {
        event_name: 'today_loaded',
        properties: { edition_id: 'edition_sec_001' },
      }),
      env,
      executionContext,
    )

    expect(response.status).toBe(200)
    const payload = await response.json<{ data: { accepted: boolean } }>()
    expect(payload.data.accepted).toBe(true)

    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM analytics_events WHERE event_name = 'today_loaded'",
    ).first<{ count: number }>()
    expect(count?.count).toBe(1)
  })

  it('rejects an event with an unknown event_name', async () => {
    const { cookie, csrfToken } = await createIdentity()

    const response = await worker.fetch(
      authenticatedPost('/api/v1/events', cookie, csrfToken, {
        event_name: 'invalid_event',
        properties: {},
      }),
      env,
      executionContext,
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    })
  })

  it('rejects events with invalid property shapes', async () => {
    const { cookie, csrfToken } = await createIdentity()

    const response = await worker.fetch(
      authenticatedPost('/api/v1/events', cookie, csrfToken, {
        event_name: 'today_loaded',
        properties: { unknown_field: 'disallowed' },
      }),
      env,
      executionContext,
    )

    expect(response.status).toBe(422)
  })

  it('records events with all valid property fields', async () => {
    const { cookie, csrfToken } = await createIdentity()

    const response = await worker.fetch(
      authenticatedPost('/api/v1/events', cookie, csrfToken, {
        event_name: 'main_committed',
        properties: {
          edition_id: 'edition_sec_001',
          mode: 'official',
          assisted: false,
          state_name: 'main_locked',
          version: '1.0',
          surface: 'web',
        },
      }),
      env,
      executionContext,
    )

    expect(response.status).toBe(200)
  })
})

describe('fairness reports API', () => {
  beforeEach(async () => {
    await env.DB.exec(
      `DELETE FROM analytics_events;
       DELETE FROM fairness_reports;
       DELETE FROM participation_credits;
       DELETE FROM result_versions;
       DELETE FROM idempotency_receipts;
       DELETE FROM attempt_commits;
       DELETE FROM attempts;
       DELETE FROM anonymous_identities;
       DELETE FROM case_rubrics;
       DELETE FROM case_public_briefs;
       DELETE FROM editions;
       DELETE FROM case_revisions;
       DELETE FROM cases;`,
    )
  })

  it('rejects unauthenticated requests', async () => {
    const response = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/fairness-reports`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      env,
      executionContext,
    )

    expect(response.status).toBe(401)
  })

  it('creates a fairness report for an owned attempt', async () => {
    await seedEditionWithBrief()
    const { cookie, csrfToken } = await createIdentity()
    const identityId = await getIdentityId(cookie)
    const attemptId = await seedAttemptWithResult(identityId)

    const response = await worker.fetch(
      authenticatedPost('/api/v1/fairness-reports', cookie, csrfToken, {
        attempt_id: attemptId,
        category: 'missing_action',
      }),
      env,
      executionContext,
    )

    expect(response.status).toBe(200)
    const payload = await response.json<{ data: { report_id: string } }>()
    expect(payload.data.report_id).toBeTruthy()

    const report = await env.DB.prepare(
      'SELECT status, category FROM fairness_reports WHERE report_id = ?',
    )
      .bind(payload.data.report_id)
      .first<{ status: string; category: string }>()
    expect(report?.status).toBe('open')
    expect(report?.category).toBe('missing_action')
  })

  it('rejects a report for a nonexistent attempt', async () => {
    const { cookie, csrfToken } = await createIdentity()

    const response = await worker.fetch(
      authenticatedPost('/api/v1/fairness-reports', cookie, csrfToken, {
        attempt_id: 'A'.repeat(43),
        category: 'other',
      }),
      env,
      executionContext,
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({
      error: { code: 'ATTEMPT_NOT_FOUND' },
    })
  })

  it('rejects a report with an invalid category', async () => {
    const { cookie, csrfToken } = await createIdentity()

    const response = await worker.fetch(
      authenticatedPost('/api/v1/fairness-reports', cookie, csrfToken, {
        attempt_id: 'A'.repeat(43),
        category: 'bogus',
      }),
      env,
      executionContext,
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    })
  })
})

describe('practice attempts API', () => {
  beforeEach(async () => {
    await env.DB.exec(
      `DELETE FROM analytics_events;
       DELETE FROM fairness_reports;
       DELETE FROM participation_credits;
       DELETE FROM result_versions;
       DELETE FROM idempotency_receipts;
       DELETE FROM attempt_commits;
       DELETE FROM attempts;
       DELETE FROM anonymous_identities;
       DELETE FROM case_rubrics;
       DELETE FROM case_public_briefs;
       DELETE FROM editions;
       DELETE FROM case_revisions;
       DELETE FROM cases;`,
    )
  })

  it('rejects unauthenticated requests', async () => {
    const response = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/practice-attempts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      env,
      executionContext,
    )

    expect(response.status).toBe(401)
  })

  it('creates a practice attempt for a released edition', async () => {
    await seedEditionWithBrief()
    const { cookie, csrfToken } = await createIdentity()

    const response = await worker.fetch(
      authenticatedPost(
        '/api/v1/practice-attempts',
        cookie,
        csrfToken,
        { edition_id: 'edition_sec_001' },
      ),
      env,
      executionContext,
    )

    expect(response.status).toBe(200)
    const payload = await response.json<{
      data: {
        attempt: {
          attempt_id: string
          mode: string
          state: string
        }
        brief: unknown
      }
    }>()
    expect(payload.data.attempt.mode).toBe('practice')
    expect(payload.data.attempt.state).toBe('issued')
    expect(payload.data.brief).toBeTruthy()
  })

  it('rejects a practice attempt for a nonexistent edition', async () => {
    const { cookie, csrfToken } = await createIdentity()

    const response = await worker.fetch(
      authenticatedPost(
        '/api/v1/practice-attempts',
        cookie,
        csrfToken,
        { edition_id: 'edition_nonexistent' },
      ),
      env,
      executionContext,
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({
      error: { code: 'NO_CURRENT_EDITION' },
    })
  })

  it('rejects a body with extra fields', async () => {
    const { cookie, csrfToken } = await createIdentity()

    const response = await worker.fetch(
      authenticatedPost(
        '/api/v1/practice-attempts',
        cookie,
        csrfToken,
        { edition_id: 'edition_sec_001', extra: true },
      ),
      env,
      executionContext,
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    })
  })

  it('rejects invalid edition_id format', async () => {
    const { cookie, csrfToken } = await createIdentity()

    const response = await worker.fetch(
      authenticatedPost(
        '/api/v1/practice-attempts',
        cookie,
        csrfToken,
        { edition_id: 'INVALID-CAPS' },
      ),
      env,
      executionContext,
    )

    expect(response.status).toBe(422)
  })
})
