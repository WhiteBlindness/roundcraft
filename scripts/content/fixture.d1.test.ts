import { env } from 'cloudflare:test'
import { beforeAll, describe, expect, it } from 'vitest'

import { publicBriefSchema } from '../../src/domain/public-brief'
import { publicFollowupSchema } from '../../src/domain/public-followup'
import { publicRevealSchema } from '../../src/domain/public-reveal'
import { serverRubricSchema } from '../../src/domain/server-rubric'
import type { Bindings } from '../../src/worker/bindings'
import worker from '../../src/worker/index'

// Rendered by vitest.content-d1.config.ts (the generator needs Node).
const fixture = env as unknown as {
  readonly FIXTURE_STATEMENTS: readonly string[]
  readonly FIXTURE_CHECKSUM: string
}
const testEnv = env as unknown as Bindings
const executionContext = {} as ExecutionContext
const apiOrigin = 'https://roundcraft.test'
const editionId = 'edition_smoke_001'
const caseRevision = 'case_revision_smoke_001'

interface Identity {
  readonly cookie: string
  readonly csrf: string
}

async function createIdentity(): Promise<Identity> {
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
    testEnv,
    executionContext,
  )
  const payload = await response.json<{ data: { csrf_token: string } }>()

  return {
    cookie: response.headers.get('set-cookie')?.split(';', 1)[0] ?? '',
    csrf: payload.data.csrf_token,
  }
}

function post(
  path: string,
  identity: Identity,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return worker.fetch(
    new Request(`${apiOrigin}${path}`, {
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
    }),
    testEnv,
    executionContext,
  )
}

async function play(
  main: { action_id: string; qualifier_id: string; evidence_ids: string[] },
  responseId: string,
) {
  const identity = await createIdentity()
  const created = await post('/api/v1/attempts', identity, { edition_id: editionId })
  const { data } = await created.json<{ data: { attempt: { attempt_id: string } } }>()
  const attemptId = data.attempt.attempt_id
  const mainCommit = await post(`/api/v1/attempts/${attemptId}/main-commit`, identity, {
    case_revision: caseRevision,
    confidence_id: 'leaning',
    ...main,
  }, {
    'idempotency-key': crypto.randomUUID(),
    'if-match': '"0"',
  })
  const followupCommit = await post(`/api/v1/attempts/${attemptId}/followup-commit`, identity, {
    case_revision: caseRevision,
    type: 'new_information',
    response_id: responseId,
  }, {
    'idempotency-key': crypto.randomUUID(),
    'if-match': '"1"',
  })

  return {
    created: created.status,
    mainCommit: mainCommit.status,
    followupCommit: followupCommit.status,
    body: await followupCommit.json<{
      data: {
        result: { total: number; main_band: string; components: Record<string, number> }
        reveal: unknown
      }
    }>(),
  }
}

describe('generated fixture SQL against a real D1 database', () => {
  beforeAll(async () => {
    await env.DB.batch(fixture.FIXTURE_STATEMENTS.map((statement) => env.DB.prepare(statement)))
  })

  it('stores a locked revision with its checksum and one row per payload', async () => {
    const revision = await env.DB.prepare(
      'SELECT status, checksum, schema_version FROM case_revisions',
    ).all()
    const counts = await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM cases) AS cases,
         (SELECT COUNT(*) FROM case_public_briefs) AS briefs,
         (SELECT COUNT(*) FROM case_followups) AS followups,
         (SELECT COUNT(*) FROM case_reveals) AS reveals,
         (SELECT COUNT(*) FROM case_rubrics) AS rubrics,
         (SELECT COUNT(*) FROM editions) AS editions`,
    ).first()

    expect(revision.results).toEqual([
      { status: 'locked', checksum: fixture.FIXTURE_CHECKSUM, schema_version: 1 },
    ])
    expect(counts).toEqual({ cases: 1, briefs: 1, followups: 1, reveals: 1, rubrics: 1, editions: 1 })
  })

  it('stores payloads that parse with the runtime domain schemas', async () => {
    const stored = async (table: string) =>
      JSON.parse(
        (await env.DB.prepare(`SELECT payload_json FROM ${table}`).first<{ payload_json: string }>())
          ?.payload_json ?? 'null',
      ) as unknown

    expect(publicBriefSchema.safeParse(await stored('case_public_briefs')).success).toBe(true)
    expect(publicFollowupSchema.safeParse(await stored('case_followups')).success).toBe(true)
    expect(publicRevealSchema.safeParse(await stored('case_reveals')).success).toBe(true)
    expect(serverRubricSchema.safeParse(await stored('case_rubrics')).success).toBe(true)
  })

  it('makes the edition current on /today with the synthetic origin label', async () => {
    const response = await worker.fetch(
      new Request(`${apiOrigin}/api/v1/today`),
      testEnv,
      executionContext,
    )
    const payload = await response.json<{
      data: { availability: string; edition: Record<string, unknown> }
    }>()

    expect(response.status).toBe(200)
    expect(payload.data.availability).toBe('available')
    expect(payload.data.edition).toMatchObject({
      edition_id: editionId,
      origin: 'synthetic',
      origin_label: 'Synthetic scenario — editorial tactical analysis.',
    })
  })

  it('can be played through with two different best main lines', async () => {
    // Middle pressure (second action) and regroup (first action) both reach Best-supported.
    const middle = await play(
      { action_id: 'b', qualifier_id: 'q3', evidence_ids: ['e4', 'e5'] },
      'change_mid',
    )
    const regroup = await play(
      { action_id: 'a', qualifier_id: 'q1', evidence_ids: ['e1', 'e2'] },
      'change_mid',
    )

    for (const run of [middle, regroup]) {
      expect(run).toMatchObject({ created: 200, mainCommit: 200, followupCommit: 200 })
      expect(run.body.data.result.main_band).toBe('Best-supported')
      expect(run.body.data.reveal).not.toBeNull()
    }
    expect(middle.body.data.result).toMatchObject({
      total: 97,
      components: { main: 50, evidence: 20, followup: 27 },
    })
    expect(regroup.body.data.result).toMatchObject({
      total: 92,
      components: { main: 45, evidence: 20, followup: 27 },
    })
  })

  it('scores every remaining answer combination without a 422', async () => {
    const weak = await play(
      { action_id: 'c', qualifier_id: 'q6', evidence_ids: ['e2', 'e3'] },
      'keep_original',
    )

    expect(weak.followupCommit).toBe(200)
    expect(weak.body.data.result.main_band).toBe('Weak')
  })
})
