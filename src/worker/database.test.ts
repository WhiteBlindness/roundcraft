import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

const identityId = 'identity_test_01'
const caseId = 'case_test_01'
const caseRevision = 'case_rev_test_01'
const editionId = 'edition_test_01'

async function seedEdition() {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO anonymous_identities (
        identity_id, token_verifier, status, created_at, expires_at
      ) VALUES (?, ?, 'active', ?, ?)`,
    ).bind(
      identityId,
      'verifier_test_01',
      '2026-09-01T00:00:00.000Z',
      '2026-11-30T00:00:00.000Z',
    ),
    env.DB.prepare(
      `INSERT INTO cases (case_id, origin, created_at)
       VALUES (?, 'synthetic', ?)`,
    ).bind(caseId, '2026-09-01T00:00:00.000Z'),
    env.DB.prepare(
      `INSERT INTO case_revisions (
        case_revision, case_id, schema_version, checksum, status, created_at
      ) VALUES (?, ?, 1, ?, 'locked', ?)`,
    ).bind(
      caseRevision,
      caseId,
      'checksum_case_rev_test_01',
      '2026-09-01T00:00:00.000Z',
    ),
    env.DB.prepare(
      `INSERT INTO editions (
        edition_id, case_revision, release_at, official_end_at,
        grace_end_at, publication_status, public_metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'released', ?, ?)`,
    ).bind(
      editionId,
      caseRevision,
      '2026-09-01T00:00:00.000Z',
      '2026-09-02T00:00:00.000Z',
      '2026-09-02T12:00:00.000Z',
      JSON.stringify({ title: 'Synthetic test edition' }),
      '2026-09-01T00:00:00.000Z',
    ),
    env.DB.prepare(
      `INSERT INTO case_rubrics (
        rubric_revision, case_revision, payload_json, checksum, created_at
      ) VALUES (?, ?, ?, ?, ?)`,
    ).bind(
      'rubric_rev_test_01',
      caseRevision,
      JSON.stringify({ schemaVersion: 1, dimensions: [] }),
      'checksum_rubric_rev_test_01',
      '2026-09-01T00:00:00.000Z',
    ),
  ])
}

describe('initial D1 schema', () => {
  it('creates the authoritative and stage-separated tables', async () => {
    const result = await env.DB.prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
    ).all<{ name: string }>()
    const tableNames = result.results.map(({ name }) => name)

    expect(tableNames).toEqual(
      expect.arrayContaining([
        'anonymous_identities',
        'cases',
        'case_revisions',
        'editions',
        'case_public_briefs',
        'case_followups',
        'case_reveals',
        'case_rubrics',
        'attempts',
        'attempt_commits',
        'idempotency_receipts',
        'result_versions',
      ]),
    )
  })

  it('allows one official attempt and unlimited practice attempts per edition', async () => {
    await seedEdition()

    const insertAttempt = (attemptId: string, mode: 'official' | 'practice') =>
      env.DB.prepare(
        `INSERT INTO attempts (
          attempt_id, identity_id, edition_id, case_revision,
          rubric_revision, ruleset_revision, mode, state, sequence,
          assisted, issued_at, grace_end_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'issued', 0, 0, ?, ?)`,
      ).bind(
        attemptId,
        identityId,
        editionId,
        caseRevision,
        'rubric_rev_test_01',
        'ruleset_rev_test_01',
        mode,
        '2026-09-01T00:10:00.000Z',
        '2026-09-02T12:00:00.000Z',
      )

    await insertAttempt('attempt_official_01', 'official').run()
    await expect(
      insertAttempt('attempt_official_02', 'official').run(),
    ).rejects.toThrow()
    await insertAttempt('attempt_practice_01', 'practice').run()
    await insertAttempt('attempt_practice_02', 'practice').run()

    const result = await env.DB.prepare(
      'SELECT mode, COUNT(*) AS count FROM attempts GROUP BY mode',
    ).all<{ mode: string; count: number }>()

    expect(result.results).toEqual(
      expect.arrayContaining([
        { mode: 'official', count: 1 },
        { mode: 'practice', count: 2 },
      ]),
    )
  })
})
