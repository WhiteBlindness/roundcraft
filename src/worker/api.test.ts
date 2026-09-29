import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Bindings } from './bindings'
import worker from './index'

const executionContext = {} as ExecutionContext
const apiOrigin = 'https://roundcraft.test'

function sessionRequest(cookie?: string) {
  const headers = new Headers({
    'content-type': 'application/json',
    origin: apiOrigin,
    'sec-fetch-site': 'same-origin',
  })

  if (cookie) {
    headers.set('cookie', cookie)
  }

  return new Request(`${apiOrigin}/api/v1/session`, {
    method: 'POST',
    headers,
    body: '{}',
  })
}

function cookiePair(setCookie: string) {
  return setCookie.split(';', 1)[0] ?? ''
}

async function seedCurrentEdition() {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO cases (case_id, origin, created_at)
       VALUES (?, 'synthetic', ?)`,
    ).bind('case_today_001', '2026-09-01T00:00:00.000Z'),
    env.DB.prepare(
      `INSERT INTO case_revisions (
        case_revision, case_id, schema_version, checksum, status, created_at
      ) VALUES (?, ?, 1, ?, 'locked', ?)`,
    ).bind(
      'case_revision_today_001',
      'case_today_001',
      'checksum_today_001',
      '2026-09-01T00:00:00.000Z',
    ),
    env.DB.prepare(
      `INSERT INTO editions (
        edition_id, case_revision, release_at, official_end_at,
        grace_end_at, publication_status, public_metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'released', ?, ?)`,
    ).bind(
      'edition_today_001',
      'case_revision_today_001',
      '2026-01-01T00:00:00.000Z',
      '2099-01-01T00:00:00.000Z',
      '2099-01-01T12:00:00.000Z',
      JSON.stringify({
        case_number: 1,
        edition_date_utc: '2026-09-01',
        estimated_minutes: 7,
        focus: 'Information',
        origin_label: 'Synthetic scenario — editorial tactical analysis.',
        hidden_answer: 'must never leave D1',
      }),
      '2026-09-01T00:00:00.000Z',
    ),
  ])
}

describe('session and Today API', () => {
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
       DELETE FROM case_reveals;
       DELETE FROM case_followups;
       DELETE FROM case_public_briefs;
       DELETE FROM editions;
       DELETE FROM case_revisions;
       DELETE FROM cases;`,
    )
  })

  it('issues a secure pseudonymous session without storing the raw token', async () => {
    const response = await worker.fetch(sessionRequest(), env, executionContext)
    const payload = await response.json<{
      data: { csrf_token: string; identity_expires_at: string }
    }>()
    const setCookie = response.headers.get('set-cookie') ?? ''

    expect(response.status).toBe(200)
    expect(setCookie).toMatch(
      /^__Host-roundcraft=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; Secure; SameSite=Strict;/,
    )
    expect(payload.data.csrf_token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(payload.data.identity_expires_at).toMatch(/Z$/)

    const stored = await env.DB.prepare(
      'SELECT token_verifier FROM anonymous_identities',
    ).first<{ token_verifier: string }>()
    const [, rawToken] = cookiePair(setCookie).split('=', 2)

    expect(stored?.token_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(rawToken).toBeDefined()
    expect(stored?.token_verifier).not.toBe(rawToken)
  })

  it('reuses a valid identity instead of creating a second record', async () => {
    const first = await worker.fetch(sessionRequest(), env, executionContext)
    const second = await worker.fetch(
      sessionRequest(cookiePair(first.headers.get('set-cookie') ?? '')),
      env,
      executionContext,
    )
    const count = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM anonymous_identities',
    ).first<{ count: number }>()

    expect(second.status).toBe(200)
    expect(count?.count).toBe(1)
  })

  it('rejects cross-site session creation before writing to D1', async () => {
    const request = sessionRequest()
    request.headers.set('origin', 'https://attacker.example')
    request.headers.set('sec-fetch-site', 'cross-site')

    const response = await worker.fetch(request, env, executionContext)
    const count = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM anonymous_identities',
    ).first<{ count: number }>()

    expect(response.status).toBe(403)
    expect(count?.count).toBe(0)
  })

  it('rate-limits session creation before writing to D1', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false })
    const limitedEnv: Bindings = {
      APP_ENV: env.APP_ENV,
      DB: env.DB,
      IDENTITY_PEPPER: env.IDENTITY_PEPPER,
      SESSION_RATE_LIMITER: { limit } as RateLimit,
    }

    const response = await worker.fetch(
      sessionRequest(),
      limitedEnv,
      executionContext,
    )
    const count = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM anonymous_identities',
    ).first<{ count: number }>()

    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({
      error: { code: 'RATE_LIMITED' },
    })
    expect(limit).toHaveBeenCalledOnce()
    expect(count?.count).toBe(0)
  })

  it('returns a neutral unavailable Today state when nothing is released', async () => {
    const response = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/today`),
      env,
      executionContext,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      data: {
        availability: 'unavailable',
        edition: null,
        status: 'unavailable',
        primary_action: 'retry_later',
      },
      error: null,
    })
    expect(response.headers.get('etag')).toBeTruthy()
  })

  it('rate-limits repeated Today requests before reading D1', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false })
    const limitedEnv: Bindings = {
      APP_ENV: env.APP_ENV,
      DB: env.DB,
      IDENTITY_PEPPER: env.IDENTITY_PEPPER,
      TODAY_RATE_LIMITER: { limit } as RateLimit,
    }

    const response = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/today`),
      limitedEnv,
      executionContext,
    )

    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({
      error: { code: 'RATE_LIMITED' },
    })
    expect(limit).toHaveBeenCalledOnce()
  })

  it('returns only the approved public cover for the released edition', async () => {
    await seedCurrentEdition()

    const response = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/today`),
      env,
      executionContext,
    )
    const text = await response.text()
    const payload = JSON.parse(text)

    expect(response.status).toBe(200)
    expect(payload.data).toEqual({
      availability: 'available',
      edition: {
        edition_id: 'edition_today_001',
        case_number: 1,
        edition_date_utc: '2026-09-01',
        estimated_minutes: 7,
        focus: 'Information',
        status: 'new',
        primary_action: 'start_case',
        origin: 'synthetic',
        origin_label: 'Synthetic scenario — editorial tactical analysis.',
      },
    })
    expect(text).not.toContain('hidden_answer')
    expect(response.headers.get('cache-control')).toBe('private, no-cache')
    expect(response.headers.get('etag')).toMatch(/^"[A-Za-z0-9_-]{43}"$/)
  })
})
