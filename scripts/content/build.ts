import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  contentChecksum,
  defaultRoot,
  indexMigrations,
  loadCases,
  migrationFileName,
  renderMigration,
} from './lib'
import type { GeneratedMigration } from './lib'
import { validateCases } from './validate'

export interface BuildPlan {
  /** Migration files to create, in order. Empty in --check mode. */
  readonly writes: readonly { readonly fileName: string; readonly text: string }[]
  readonly errors: readonly string[]
  readonly notes: readonly string[]
}

export interface BuildOptions {
  readonly root?: string
  /** Fail instead of writing when a migration is missing or stale. */
  readonly check?: boolean
  /** Restrict the run to one case; also makes refusals explicit. */
  readonly caseId?: string | undefined
}

const UNPUBLISHABLE_STATUSES = new Set(['draft', 'technically_validated', 'tactically_reviewed'])

/** Pure planning step: reads the repository, never writes. */
export function planBuild(options: BuildOptions = {}): BuildPlan {
  const root = options.root ?? defaultRoot()
  const errors: string[] = []
  const notes: string[] = []
  const writes: { fileName: string; text: string }[] = []

  const loaded = loadCases(root)
  const reports = validateCases(loaded)
  const index = indexMigrations(root)
  let nextNumber = index.highestNumber + 1

  if (options.caseId) {
    const requested = reports.find((report) => report.id === options.caseId)
    if (!requested) {
      errors.push(`No case named "${options.caseId}" under content/`)
    } else if (requested.fixture) {
      errors.push(`Refusing ${requested.id}: fixtures are never published to production`)
    } else if (requested.status !== 'ready' && requested.status !== 'withdrawn') {
      errors.push(`Refusing ${requested.id}: status is "${requested.status ?? 'unknown'}", only "ready" or "withdrawn" cases are built`)
    }
  }

  const ofKind = (kind: GeneratedMigration['kind'], caseId: string, revision: string) =>
    index.generated.find(
      (migration) =>
        migration.kind === kind &&
        migration.caseId === caseId &&
        migration.revision === revision,
    )

  for (const report of reports) {
    if (options.caseId && report.id !== options.caseId) continue
    const caseFile = report.caseFile
    if (!caseFile || report.fixture) continue

    const { caseId } = caseFile
    const revision = caseFile.editorial.revision
    const checksum = contentChecksum(caseFile)
    const published = ofKind('publish', caseId, revision)
    const withdrawn = ofKind('withdraw', caseId, revision)

    // A different revision of this case was already published: revisions are
    // immutable, so this file must keep describing the published one.
    for (const other of index.generated) {
      if (other.kind === 'publish' && other.caseId === caseId && other.revision !== revision) {
        errors.push(
          `${report.id}: revision ${other.revision} was already published (${other.fileName}) but the case file now says ${revision}. Published revisions are immutable: restore the old revision, withdraw it, and ship the corrected case under a new case id.`,
        )
      }
    }

    // Locked content must never change silently.
    if (published) {
      if (published.contentChecksum !== checksum || !published.text.includes(`'${published.contentChecksum}'`)) {
        errors.push(
          `${report.id}: content changed after ${published.fileName} was generated (expected ${published.contentChecksum}, now ${checksum}). Locked revisions are immutable: withdraw it and publish the corrected case under a new case id.`,
        )
        continue
      }
      if (UNPUBLISHABLE_STATUSES.has(report.status ?? '')) {
        errors.push(
          `${report.id}: status is "${report.status}" but revision ${revision} is already published (${published.fileName}). Set the status to "withdrawn" to retire it.`,
        )
        continue
      }
    }

    if (report.status === 'ready') {
      if (report.errors.length > 0) {
        errors.push(`${report.id}: cannot build, validation failed (run npm run content:validate -- --case ${report.id})`)
        continue
      }
      if (published) {
        notes.push(`${report.id}: up to date (${published.fileName})`)
        continue
      }
      if (options.check) {
        errors.push(`${report.id}: ready but has no publish migration; run npm run content:build and commit the result`)
        continue
      }
      const fileName = migrationFileName(nextNumber, 'publish', caseFile)
      nextNumber += 1
      writes.push({ fileName, text: renderMigration('publish', caseFile) })
      notes.push(`${report.id}: will write ${fileName}`)
    } else if (report.status === 'withdrawn' && published) {
      if (withdrawn) {
        notes.push(`${report.id}: withdrawn (${withdrawn.fileName})`)
        continue
      }
      if (options.check) {
        errors.push(`${report.id}: withdrawn but has no withdraw migration; run npm run content:build and commit the result`)
        continue
      }
      const fileName = migrationFileName(nextNumber, 'withdraw', caseFile)
      nextNumber += 1
      writes.push({ fileName, text: renderMigration('withdraw', caseFile) })
      notes.push(`${report.id}: will write ${fileName}`)
    }
  }

  if (!options.caseId) {
    const known = new Set(reports.filter((report) => !report.fixture && report.caseFile !== null).map((report) => report.id))
    for (const migration of index.generated) {
      if (!known.has(migration.caseId)) {
        errors.push(
          `${migration.fileName}: no valid case file content/cases/${migration.caseId}.json; published cases must stay in the repository (set status "withdrawn" instead of deleting)`,
        )
      }
    }
  }

  return { writes, errors, notes }
}

export function runBuild(argv: readonly string[], root = defaultRoot()): number {
  const check = argv.includes('--check')
  const caseIndex = argv.indexOf('--case')
  const caseId = caseIndex >= 0 ? argv[caseIndex + 1] : undefined
  if (caseIndex >= 0 && !caseId) {
    console.error('--case requires a case id')
    return 2
  }

  const plan = planBuild({ root, check, caseId })
  for (const note of plan.notes) console.log(note)
  for (const message of plan.errors) console.error(`error: ${message}`)
  if (plan.errors.length > 0) return 1

  if (!check && plan.writes.length > 0) {
    mkdirSync(join(root, 'migrations'), { recursive: true })
    for (const { fileName, text } of plan.writes) {
      writeFileSync(join(root, 'migrations', fileName), text, { flag: 'wx' })
      console.log(`wrote migrations/${fileName}`)
    }
  }

  if (plan.writes.length === 0) {
    console.log(check ? 'Generated migrations are up to date.' : 'Nothing to build.')
  }

  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runBuild(process.argv.slice(2))
}
