import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { defaultRoot } from './lib'
import type { LoadedCase } from './lib'

export type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export function fixtureJson(): Json {
  return JSON.parse(
    readFileSync(join(defaultRoot(), 'content', 'fixtures', 'case_smoke_001.json'), 'utf8'),
  ) as Json
}

/** A fixture-shaped case as if it lived under content/fixtures/. */
export function asLoaded(data: unknown, id = 'case_smoke_001', dir: 'cases' | 'fixtures' = 'fixtures'): LoadedCase {
  return { id, file: `content/${dir}/${id}.json`, dir, data }
}

/** A valid, publishable production case derived from the fixture. */
export function readyCase(
  suffix: string,
  window: { releaseAt: string; officialEndAt: string; graceEndAt: string },
  overrides: (draft: Json) => void = () => {},
): Json {
  const text = JSON.stringify(fixtureJson()).replaceAll('smoke_001', suffix)
  const draft = JSON.parse(text) as Json
  delete draft.fixture
  draft.editorial.status = 'ready'
  draft.editorial.author = 'Author Person'
  draft.editorial.reviewers = [
    { name: 'Reviewer One', reviewedAt: '2026-09-01', verdict: 'approved', notes: 'Plausible.' },
    { name: 'Reviewer Two', reviewedAt: '2026-09-02', verdict: 'approved', notes: 'Agreed.' },
  ]
  draft.edition = { ...draft.edition, ...window }
  overrides(draft)
  return draft
}

export const WINDOW_A = {
  releaseAt: '2027-01-01T06:00:00.000Z',
  officialEndAt: '2027-01-02T06:00:00.000Z',
  graceEndAt: '2027-01-02T18:00:00.000Z',
}

export const WINDOW_B = {
  releaseAt: '2027-01-02T06:00:00.000Z',
  officialEndAt: '2027-01-03T06:00:00.000Z',
  graceEndAt: '2027-01-03T18:00:00.000Z',
}

/** Temporary repository root with real migrations plus the given case files. */
export function makeRoot(files: Readonly<Record<string, unknown>> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'roundcraft-content-test-'))
  mkdirSync(join(root, 'content', 'cases'), { recursive: true })
  mkdirSync(join(root, 'content', 'fixtures'), { recursive: true })
  mkdirSync(join(root, 'migrations'))
  for (const name of ['0001_initial.sql', '0002_seed_cases.sql']) {
    cpSync(join(defaultRoot(), 'migrations', name), join(root, 'migrations', name))
  }
  for (const [relative, data] of Object.entries(files)) {
    writeFileSync(join(root, relative), `${JSON.stringify(data, null, 2)}\n`)
  }
  return root
}
