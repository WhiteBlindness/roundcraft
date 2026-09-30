import { pathToFileURL } from 'node:url'

import type { FollowupAnswer } from '../../src/domain/followup-answer'
import type { MainAnswer } from '../../src/domain/main-answer'
import { outcomeBand } from '../../src/domain/outcome-band'
import { publicBriefSchema } from '../../src/domain/public-brief'
import type { PublicBrief } from '../../src/domain/public-brief'
import { publicFollowupSchema } from '../../src/domain/public-followup'
import type { PublicFollowup } from '../../src/domain/public-followup'
import { publicRevealSchema } from '../../src/domain/public-reveal'
import type { PublicReveal } from '../../src/domain/public-reveal'
import { scoreDecision } from '../../src/domain/scoring'
import { scoringInputFor, serverRubricSchema } from '../../src/domain/server-rubric'
import type { ServerRubric } from '../../src/domain/server-rubric'
import { defaultRoot, loadCases } from './lib'
import {
  bestLineByAction,
  duplicates,
  followupKey,
  followupMatrixFindings,
  mainLineQualities,
  sample,
} from './rubric-analysis'
import type { LoadedCase } from './lib'
import {
  caseFileSchema,
  STATUS_RANK,
  SYNTHETIC_ORIGIN_LABEL,
} from './schema'
import type { CaseFileEnvelope, CaseStatus } from './schema'

export interface Issue {
  readonly severity: 'error' | 'warning'
  readonly code: string
  readonly message: string
}

export interface CaseReport {
  readonly id: string
  readonly file: string
  readonly status: CaseStatus | null
  readonly fixture: boolean
  readonly errors: readonly Issue[]
  readonly warnings: readonly Issue[]
  /** True only for a `ready`, non-fixture case without errors. */
  readonly publishable: boolean
  /** True when errors must fail the run (status >= technically_validated, or a fixture). */
  readonly enforced: boolean
  readonly caseFile: CaseFileEnvelope | null
}

const SHARED_WORD_WINDOW = 6

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function zodMessages(prefix: string, error: {
  readonly issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[]
}): string[] {
  const shown = error.issues.slice(0, 6).map((issue) => {
    const path = issue.path.map(String).join('.')
    return `${prefix}${path ? `.${path}` : ''}: ${issue.message}`
  })
  const hidden = error.issues.length - shown.length

  return hidden > 0 ? [...shown, `${prefix}: … and ${hidden} more issue(s)`] : shown
}

function evidencePairs(ids: readonly string[]): string[] {
  const sorted = [...ids].sort()
  const pairs: string[] = []
  for (let first = 0; first < sorted.length; first += 1) {
    for (let second = first + 1; second < sorted.length; second += 1) {
      pairs.push(`${sorted[first]}|${sorted[second]}`)
    }
  }
  return pairs
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter((word) => word.length > 0)
}

function shingles(text: string): string[] {
  const tokens = words(text)
  const result: string[] = []
  for (let index = 0; index + SHARED_WORD_WINDOW <= tokens.length; index += 1) {
    result.push(tokens.slice(index, index + SHARED_WORD_WINDOW).join(' '))
  }
  return result
}

interface TextField {
  readonly path: string
  readonly text: string
}

const NON_PROSE_KEYS = new Set([
  'evidenceId',
  'kind',
  'timestamp',
  'caseRevision',
  'schemaVersion',
  'editionId',
  'id',
])

function proseFields(value: unknown, path: string): TextField[] {
  if (typeof value === 'string') return [{ path, text: value }]
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => proseFields(item, `${path}[${index}]`))
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      NON_PROSE_KEYS.has(key) ? [] : proseFields(item, `${path}.${key}`),
    )
  }
  return []
}

function briefFields(brief: PublicBrief): TextField[] {
  return [
    { path: 'brief.title', text: brief.title },
    { path: 'brief.focus', text: brief.focus },
    ...brief.facts.map((fact) => ({ path: `brief.facts.${fact.id}`, text: fact.text })),
    ...brief.actions.map((action) => ({ path: `brief.actions.${action.id}`, text: action.label })),
    ...brief.qualifiers.map((item) => ({ path: `brief.qualifiers.${item.id}`, text: item.label })),
    ...brief.evidence.map((item) => ({ path: `brief.evidence.${item.id}`, text: item.label })),
    ...brief.confidence.map((item) => ({ path: `brief.confidence.${item.id}`, text: item.label })),
  ]
}

function followupFields(followup: PublicFollowup): TextField[] {
  const options =
    followup.type === 'new_information'
      ? followup.responses
      : [...followup.postures, ...followup.priorities]

  return [
    { path: 'followup.heading', text: followup.heading },
    { path: 'followup.stimulus', text: followup.stimulus },
    ...followup.updates.map((update) => ({ path: `followup.updates.${update.id}`, text: update.text })),
    ...options.map((option) => ({ path: `followup.options.${option.id}`, text: option.label })),
  ]
}

const FACT_AGE_PATTERN =
  /\bago\b|\b\d+\s?(?:s|sec|secs|seconds?|m|min|mins|minutes?)\b|\b(?:seconds?|minutes?)\b/i

// ---------------------------------------------------------------------------
// Per-case validation
// ---------------------------------------------------------------------------

interface ParsedPayloads {
  readonly brief: PublicBrief
  readonly followup: PublicFollowup
  readonly reveal: PublicReveal
  readonly rubric: ServerRubric
}

export function validateCase(loaded: LoadedCase): CaseReport {
  const issues: Issue[] = []
  const error = (code: string, message: string) => {
    issues.push({ severity: 'error', code, message })
  }
  const warn = (code: string, message: string) => {
    issues.push({ severity: 'warning', code, message })
  }
  const finish = (
    status: CaseStatus | null,
    fixture: boolean,
    caseFile: CaseFileEnvelope | null,
  ): CaseReport => {
    const errors = issues.filter((issue) => issue.severity === 'error')
    const warnings = issues.filter((issue) => issue.severity === 'warning')
    return {
      id: loaded.id,
      file: loaded.file,
      status,
      fixture,
      errors,
      warnings,
      publishable: errors.length === 0 && status === 'ready' && !fixture,
      // A file we cannot even read is never silently tolerated.
      enforced:
        status === null || fixture || STATUS_RANK[status] >= STATUS_RANK.technically_validated,
      caseFile,
    }
  }

  if (loaded.parseError !== undefined) {
    error('invalid_json', `${loaded.file}: ${loaded.parseError}`)
    return finish(null, loaded.dir === 'fixtures', null)
  }

  const envelope = caseFileSchema.safeParse(loaded.data)
  if (!envelope.success) {
    for (const message of zodMessages('case', envelope.error)) {
      error('invalid_envelope', message)
    }
    const rawStatus = (loaded.data as { editorial?: { status?: unknown } } | null)
      ?.editorial?.status
    const knownStatus =
      typeof rawStatus === 'string' && rawStatus in STATUS_RANK
        ? (rawStatus as CaseStatus)
        : null
    return finish(knownStatus, loaded.dir === 'fixtures', null)
  }

  const caseFile = envelope.data
  const { editorial, edition } = caseFile
  const fixture = caseFile.fixture === true

  // -- identity and layout ---------------------------------------------------
  if (caseFile.caseId !== loaded.id) {
    error('case_id_mismatch', `caseId "${caseFile.caseId}" must match the file name "${loaded.id}.json"`)
  }
  if (loaded.dir === 'fixtures' && !fixture) {
    error('fixture_flag', 'files under content/fixtures/ must set "fixture": true')
  }
  if (loaded.dir === 'cases' && fixture) {
    error('fixture_flag', 'fixtures must live under content/fixtures/, not content/cases/')
  }
  if (fixture && editorial.status === 'ready') {
    error('fixture_ready', 'a fixture can never be "ready"; fixtures are never published to production')
  }

  // -- payload schemas -------------------------------------------------------
  const briefResult = publicBriefSchema.safeParse(caseFile.brief)
  const followupResult = publicFollowupSchema.safeParse(caseFile.followup)
  const revealResult = publicRevealSchema.safeParse(caseFile.reveal)
  const rubricResult = serverRubricSchema.safeParse(caseFile.rubric)

  if (!briefResult.success) {
    for (const message of zodMessages('brief', briefResult.error)) error('brief_schema', message)
  }
  if (!followupResult.success) {
    for (const message of zodMessages('followup', followupResult.error)) error('followup_schema', message)
  }
  if (!revealResult.success) {
    for (const message of zodMessages('reveal', revealResult.error)) error('reveal_schema', message)
  }
  if (!rubricResult.success) {
    for (const message of zodMessages('rubric', rubricResult.error)) error('rubric_schema', message)
  }

  // -- revision and edition consistency --------------------------------------
  const revisions: Record<string, unknown> = {
    brief: caseFile.brief['caseRevision'],
    followup: caseFile.followup['caseRevision'],
    reveal: caseFile.reveal['caseRevision'],
    rubric: caseFile.rubric['caseRevision'],
  }
  for (const [name, revision] of Object.entries(revisions)) {
    if (revision !== editorial.revision) {
      error(
        'revision_mismatch',
        `${name}.caseRevision "${String(revision)}" must equal editorial.revision "${editorial.revision}"`,
      )
    }
  }
  if (caseFile.brief['editionId'] !== edition.editionId) {
    error(
      'edition_mismatch',
      `brief.editionId "${String(caseFile.brief['editionId'])}" must equal edition.editionId "${edition.editionId}"`,
    )
  }
  if (caseFile.rubric['rubricRevision'] !== editorial.rubricRevision) {
    error(
      'rubric_revision_mismatch',
      `rubric.rubricRevision "${String(caseFile.rubric['rubricRevision'])}" must equal editorial.rubricRevision "${editorial.rubricRevision}"`,
    )
  }
  if (caseFile.brief['origin'] !== caseFile.origin) {
    error(
      'origin_mismatch',
      `brief.origin "${String(caseFile.brief['origin'])}" must equal the case origin "${caseFile.origin}"`,
    )
  }

  // -- origin honesty --------------------------------------------------------
  const label = edition.publicMetadata.origin_label
  if (caseFile.origin === 'synthetic') {
    if (label !== SYNTHETIC_ORIGIN_LABEL) {
      error('origin_label', `synthetic cases must use the origin label "${SYNTHETIC_ORIGIN_LABEL}" (got "${label}")`)
    }
    if (revealResult.success && revealResult.data.continuation.kind === 'observed') {
      error('origin_observed', 'a synthetic case cannot claim an "observed" continuation')
    }
  } else {
    if (!editorial.provenance?.trim()) {
      error('provenance_missing', 'professional cases require a non-empty editorial.provenance')
    }
    if (!editorial.rights?.trim()) {
      error('rights_missing', 'professional cases require a non-empty editorial.rights')
    }
    if (label === SYNTHETIC_ORIGIN_LABEL) {
      error('origin_label', 'a professional case must not use the synthetic origin label')
    }
  }

  // -- schedule ---------------------------------------------------------------
  const { releaseAt, officialEndAt, graceEndAt } = edition
  const scheduleComplete = releaseAt !== null && officialEndAt !== null && graceEndAt !== null
  if (scheduleComplete && !(releaseAt < officialEndAt && officialEndAt <= graceEndAt)) {
    error('schedule_order', 'edition schedule must satisfy releaseAt < officialEndAt <= graceEndAt')
  }
  if (editorial.status === 'ready' && !scheduleComplete) {
    error('schedule_missing', 'a ready case requires releaseAt, officialEndAt and graceEndAt')
  }
  if (releaseAt !== null && releaseAt.slice(0, 10) !== edition.publicMetadata.edition_date_utc) {
    warn(
      'edition_date',
      `publicMetadata.edition_date_utc (${edition.publicMetadata.edition_date_utc}) differs from the releaseAt date (${releaseAt.slice(0, 10)})`,
    )
  }

  // -- status gating ----------------------------------------------------------
  const author = editorial.author.trim().toLowerCase()
  const independentApprovals = editorial.reviewers.filter(
    (reviewer) =>
      reviewer.verdict === 'approved' && reviewer.name.trim().toLowerCase() !== author,
  )
  if (
    (editorial.status === 'tactically_reviewed' || editorial.status === 'ready') &&
    independentApprovals.length === 0
  ) {
    error(
      'review_missing',
      `status "${editorial.status}" requires at least one approving reviewer who is not the author`,
    )
  }
  if (
    (editorial.status === 'tactically_reviewed' || editorial.status === 'ready') &&
    new Set(independentApprovals.map((reviewer) => reviewer.name.trim().toLowerCase())).size < 2
  ) {
    warn('single_review', 'the architecture calls for two independent tactical reviews')
  }
  const latestByReviewer = new Map<string, { at: string; verdict: string }>()
  for (const reviewer of editorial.reviewers) {
    const key = reviewer.name.trim().toLowerCase()
    const previous = latestByReviewer.get(key)
    if (!previous || reviewer.reviewedAt >= previous.at) {
      latestByReviewer.set(key, { at: reviewer.reviewedAt, verdict: reviewer.verdict })
    }
  }
  if ([...latestByReviewer.values()].some(({ verdict }) => verdict === 'changes_requested')) {
    warn('changes_requested', 'a reviewer\'s latest verdict is "changes_requested"')
  }
  if (editorial.status === 'ready' && editorial.knownIssues.length > 0) {
    warn('known_issues', 'a ready case still lists editorial.knownIssues')
  }

  // Everything below needs all four payloads to have parsed.
  if (
    !briefResult.success ||
    !followupResult.success ||
    !revealResult.success ||
    !rubricResult.success
  ) {
    return finish(editorial.status, fixture, caseFile)
  }

  checkPayloads(
    { brief: briefResult.data, followup: followupResult.data, reveal: revealResult.data, rubric: rubricResult.data },
    error,
    warn,
  )

  return finish(editorial.status, fixture, caseFile)
}

function checkPayloads(
  { brief, followup, reveal, rubric }: ParsedPayloads,
  error: (code: string, message: string) => void,
  warn: (code: string, message: string) => void,
): void {
  const actionIds = new Set(brief.actions.map(({ id }) => id))
  const evidenceIds = new Set(brief.evidence.map(({ id }) => id))

  // -- main matrix ------------------------------------------------------------
  const mainCells = new Map<string, number>()
  for (const cell of rubric.main) {
    const key = `${cell.actionId}/${cell.qualifierId}`
    mainCells.set(key, (mainCells.get(key) ?? 0) + 1)
    const action = brief.actions.find(({ id }) => id === cell.actionId)
    if (!action) {
      error('main_unknown_action', `rubric.main references unpublished action "${cell.actionId}"`)
    } else if (!action.qualifierIds.includes(cell.qualifierId)) {
      error('main_unknown_qualifier', `rubric.main cell ${key}: qualifier is not published for that action`)
    }
  }
  const repeatedMain = [...mainCells].filter(([, count]) => count > 1).map(([key]) => key)
  if (repeatedMain.length > 0) {
    error('main_duplicate', `rubric.main has duplicate cells: ${sample(repeatedMain)}`)
  }
  const missingMain = brief.actions.flatMap((action) =>
    action.qualifierIds
      .filter((qualifierId) => !mainCells.has(`${action.id}/${qualifierId}`))
      .map((qualifierId) => `${action.id}/${qualifierId}`),
  )
  if (missingMain.length > 0) {
    error('main_incomplete', `rubric.main is missing published action×qualifier cells: ${sample(missingMain)}`)
  }

  // -- evidence matrix --------------------------------------------------------
  const expectedPairs = evidencePairs([...evidenceIds])
  const cellsByAction = new Map<string, string[]>()
  for (const cell of rubric.evidence) {
    if (!actionIds.has(cell.actionId)) {
      error('evidence_unknown_action', `rubric.evidence references unpublished action "${cell.actionId}"`)
      continue
    }
    const unknown = cell.evidenceIds.filter((id) => !evidenceIds.has(id))
    if (unknown.length > 0) {
      error('evidence_unknown_id', `rubric.evidence (${cell.actionId}) references evidence not in the brief: ${unknown.join(', ')}`)
      continue
    }
    const keys = cellsByAction.get(cell.actionId) ?? []
    keys.push([...cell.evidenceIds].sort().join('|'))
    cellsByAction.set(cell.actionId, keys)
  }
  for (const action of brief.actions) {
    const keys = cellsByAction.get(action.id) ?? []
    const present = new Set(keys)
    const missing = expectedPairs.filter((pair) => !present.has(pair))
    const repeated = duplicates(keys)
    if (missing.length > 0) {
      error(
        'evidence_incomplete',
        `evidence matrix for action "${action.id}" covers ${expectedPairs.length - missing.length} of ${expectedPairs.length} evidence pairs; missing: ${sample(missing)}`,
      )
    }
    if (repeated.length > 0) {
      error('evidence_duplicate', `evidence matrix for action "${action.id}" repeats pairs: ${sample(repeated)}`)
    }
  }

  // -- follow-up matrix -------------------------------------------------------
  const followupAnswers = followupAnswersFor(followup)
  if (rubric.followup.type !== followup.type) {
    error('followup_type', `rubric.followup.type "${rubric.followup.type}" must equal followup.type "${followup.type}"`)
  } else {
    for (const finding of followupMatrixFindings(brief, rubric, followupAnswers)) {
      if (finding.severity === 'error') error(finding.code, finding.message)
      else warn(finding.code, finding.message)
    }
  }

  // -- reveal references --------------------------------------------------------
  for (const review of reveal.debrief.evidenceReview) {
    if (!evidenceIds.has(review.evidenceId)) {
      error('reveal_unknown_evidence', `reveal.debrief.evidenceReview references evidence not in the brief: "${review.evidenceId}"`)
    }
  }

  // -- exhaustive scoring -----------------------------------------------------
  checkScoring(brief, rubric, followupAnswers, error, warn)

  // -- disclosure separation --------------------------------------------------
  const briefShingles = new Set(briefFields(brief).flatMap(({ text }) => shingles(text)))
  const later: readonly TextField[] = [
    ...proseFields(reveal, 'reveal'),
    ...followupFields(followup),
  ]
  const leaks: string[] = []
  for (const field of later) {
    const shared = shingles(field.text).find((gram) => briefShingles.has(gram))
    if (shared) leaks.push(`${field.path} repeats "${shared}"`)
  }
  if (leaks.length > 0) {
    error(
      'disclosure_overlap',
      `follow-up/reveal text shares a ${SHARED_WORD_WINDOW}+ word sequence with the brief (${leaks.length} field(s)): ${sample(leaks, 3)}`,
    )
  }

  // -- fact warnings ----------------------------------------------------------
  if (!brief.facts.some(({ status }) => status === 'inferred' || status === 'unknown')) {
    warn('no_uncertain_fact', 'no fact is marked "inferred" or "unknown"; the brief presents nothing as uncertain')
  }
  for (const fact of brief.facts) {
    if (fact.status === 'last_seen' && !FACT_AGE_PATTERN.test(fact.text)) {
      warn('last_seen_without_age', `fact "${fact.id}" is last_seen but its text gives no age`)
    }
  }
}

function followupAnswersFor(followup: PublicFollowup): FollowupAnswer[] {
  if (followup.type === 'new_information') {
    return followup.responses.map((response) => ({
      case_revision: followup.caseRevision,
      type: 'new_information' as const,
      response_id: response.id,
    }))
  }

  return followup.postures.flatMap((posture) =>
    followup.priorities.map((priority) => ({
      case_revision: followup.caseRevision,
      type: 'economy_risk' as const,
      posture_id: posture.id,
      priority_id: priority.id,
    })),
  )
}

function checkScoring(
  brief: PublicBrief,
  rubric: ServerRubric,
  followupAnswers: readonly FollowupAnswer[],
  error: (code: string, message: string) => void,
  warn: (code: string, message: string) => void,
): void {
  const confidenceId = brief.confidence[0]?.id ?? 'guessing'
  const pairs = evidencePairs(brief.evidence.map(({ id }) => id)).map(
    (pair) => pair.split('|') as [string, string],
  )
  let total = 0
  const unscoreable: string[] = []
  const invalid: string[] = []

  for (const action of brief.actions) {
    for (const qualifierId of action.qualifierIds) {
      for (const pair of pairs) {
        for (const followupAnswer of followupAnswers) {
          total += 1
          const mainAnswer: MainAnswer = {
            action_id: action.id,
            qualifier_id: qualifierId,
            evidence_ids: pair,
            confidence_id: confidenceId,
          }
          const label = `${action.id}/${qualifierId} [${pair.join(',')}] × ${followupKey(followupAnswer)}`
          const input = scoringInputFor(rubric, mainAnswer, followupAnswer)
          if (input === null) {
            unscoreable.push(label)
            continue
          }
          try {
            const result = scoreDecision(input)
            const { main, evidence, followup: followupPoints } = result.components
            const integers = [result.total, main, evidence, followupPoints].every(Number.isInteger)
            if (
              !integers ||
              main < 0 || main > 50 ||
              evidence < 0 || evidence > 20 ||
              followupPoints < 0 || followupPoints > 30 ||
              result.total < 0 || result.total > 100 ||
              main + evidence + followupPoints !== result.total
            ) {
              invalid.push(label)
            }
          } catch {
            invalid.push(label)
          }
        }
      }
    }
  }

  if (unscoreable.length > 0) {
    error(
      'scoring_incomplete',
      `${unscoreable.length} of ${total} answer combinations cannot be scored (a player choosing them would get a 422); first: ${sample(unscoreable, 2)}`,
    )
  }
  if (invalid.length > 0) {
    error('scoring_invalid', `${invalid.length} answer combinations produce an invalid score: ${sample(invalid, 2)}`)
  }

  // Quality of each published line, with caps applied (drives the result band).
  const lineQuality = mainLineQualities(rubric)

  const bestOverall = Math.max(0, ...lineQuality.values())
  if (outcomeBand(bestOverall) !== 'Best-supported') {
    error(
      'no_best_supported_line',
      `no main line reaches the Best-supported band (quality >= 90); best is ${bestOverall}`,
    )
  }

  const bestByAction = [...bestLineByAction(brief, lineQuality)].map(([id, best]) => ({ id, best }))
  const top = Math.max(...bestByAction.map(({ best }) => best))
  const leaders = bestByAction.filter(({ best }) => best === top)
  if (leaders.length === 1 && leaders[0]?.id === brief.actions[0]?.id) {
    warn('best_action_first', `the best-scoring action "${leaders[0]?.id}" is the first one listed; players can guess by position`)
  }
  const defensibleActions = bestByAction.filter(({ best }) => best >= 70).length
  if (defensibleActions < 2) {
    warn('single_defensible_action', 'fewer than two actions have a defensible (>= 70) line; the decision may not be a real dilemma')
  }
}

// ---------------------------------------------------------------------------
// Cross-case validation
// ---------------------------------------------------------------------------

export function validateCases(loaded: readonly LoadedCase[]): CaseReport[] {
  const reports = loaded.map((entry) => validateCase(entry))
  const extra = new Map<string, Issue[]>()
  const add = (id: string, issue: Issue) => {
    extra.set(id, [...(extra.get(id) ?? []), issue])
  }
  const parsed = reports.filter(
    (report): report is CaseReport & { caseFile: CaseFileEnvelope } => report.caseFile !== null,
  )

  const uniqueKeys: readonly { name: string; read: (file: CaseFileEnvelope) => string }[] = [
    { name: 'caseId', read: (file) => file.caseId },
    { name: 'editorial.revision', read: (file) => file.editorial.revision },
    { name: 'editorial.rubricRevision', read: (file) => file.editorial.rubricRevision },
    { name: 'edition.editionId', read: (file) => file.edition.editionId },
  ]
  for (const { name, read } of uniqueKeys) {
    const groups = new Map<string, string[]>()
    for (const report of parsed) {
      const value = read(report.caseFile)
      groups.set(value, [...(groups.get(value) ?? []), report.id])
    }
    for (const [value, ids] of groups) {
      if (ids.length < 2) continue
      for (const id of ids) {
        add(id, {
          severity: 'error',
          code: 'duplicate_identifier',
          message: `${name} "${value}" is also used by ${ids.filter((other) => other !== id).join(', ')}`,
        })
      }
    }
  }

  const scheduled = parsed.filter(
    (report) =>
      !report.fixture &&
      report.status === 'ready' &&
      report.caseFile.edition.releaseAt !== null &&
      report.caseFile.edition.officialEndAt !== null,
  )
  for (const left of scheduled) {
    for (const right of scheduled) {
      if (left.id >= right.id) continue
      const leftEdition = left.caseFile.edition
      const rightEdition = right.caseFile.edition
      if (
        (leftEdition.releaseAt as string) < (rightEdition.officialEndAt as string) &&
        (rightEdition.releaseAt as string) < (leftEdition.officialEndAt as string)
      ) {
        for (const [self, other] of [[left, right], [right, left]] as const) {
          add(self.id, {
            severity: 'error',
            code: 'edition_overlap',
            message: `official window overlaps ready case ${other.id}`,
          })
        }
      }
    }
  }

  return reports.map((report) => {
    const added = extra.get(report.id)
    if (!added) return report
    const errors = [...report.errors, ...added.filter((issue) => issue.severity === 'error')]
    return {
      ...report,
      errors,
      publishable: errors.length === 0 && report.status === 'ready' && !report.fixture,
    }
  })
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function formatReport(report: CaseReport): string[] {
  const state = report.errors.length === 0 ? 'PASS' : report.enforced ? 'FAIL' : 'DRAFT'
  const flags = [
    `status=${report.status ?? 'unknown'}`,
    report.fixture ? 'fixture' : null,
    `errors=${report.errors.length}`,
    `warnings=${report.warnings.length}`,
    `publishable=${report.publishable ? 'yes' : 'no'}`,
  ].filter(Boolean)
  const lines = [`${state.padEnd(5)} ${report.file}  ${flags.join('  ')}`]
  for (const issue of [...report.errors, ...report.warnings]) {
    lines.push(`      ${issue.severity === 'error' ? 'error' : 'warn '} [${issue.code}] ${issue.message}`)
  }
  return lines
}

export function runValidate(argv: readonly string[], root = defaultRoot()): number {
  const caseIndex = argv.indexOf('--case')
  const wanted = caseIndex >= 0 ? argv[caseIndex + 1] : undefined
  if (caseIndex >= 0 && !wanted) {
    console.error('--case requires a case id')
    return 2
  }

  const loaded = loadCases(root)
  // Cross-case rules need every file, so validate all and then filter.
  const reports = validateCases(loaded).filter((report) => !wanted || report.id === wanted)
  if (wanted && reports.length === 0) {
    console.error(`No case or fixture named "${wanted}" under content/`)
    return 2
  }

  for (const report of reports) {
    for (const line of formatReport(report)) console.log(line)
  }

  const failing = reports.filter((report) => report.enforced && report.errors.length > 0)
  const drafts = reports.filter((report) => !report.enforced && report.errors.length > 0)
  const publishable = reports.filter((report) => report.publishable)
  console.log(
    `\n${reports.length} case file(s): ${failing.length} failing, ${drafts.length} draft(s) with readiness errors, ${publishable.length} publishable.`,
  )

  return failing.length > 0 ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runValidate(process.argv.slice(2))
}
