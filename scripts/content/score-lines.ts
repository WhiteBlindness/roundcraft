// Scores every (action, qualifier, evidence pair, follow-up answer) of a case with the production
// scoring code, so rubric proposals can be stress-tested before tactical review. The report shows how
// each follow-up answer scores after each locked main line, and flags follow-up matrices that reward
// a word rather than adaptation.
// Usage: node --no-warnings=ExperimentalWarning --import ./scripts/content/register.mjs scripts/content/score-lines.ts <case-id> [--json]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { FollowupAnswer } from '../../src/domain/followup-answer'
import { publicBriefSchema } from '../../src/domain/public-brief'
import { publicFollowupSchema } from '../../src/domain/public-followup'
import { scoreDecision } from '../../src/domain/scoring'
import { publishedFollowupAnswers, scoringInputFor, serverRubricSchema } from '../../src/domain/server-rubric'
import { bestLineByAction, followupKey, followupMatrixFindings, mainLineQualities } from './rubric-analysis'

// Piping into head or grep must not crash with EPIPE.
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') process.exit(0)
  throw error
})

const caseId = process.argv[2]
if (!caseId) {
  console.error('usage: score-lines <case-id> [--json]')
  process.exit(2)
}
const file = JSON.parse(readFileSync(join('content', 'cases', `${caseId}.json`), 'utf8'))
const brief = publicBriefSchema.parse(file.brief)
const followup = publicFollowupSchema.parse(file.followup)
const rubric = serverRubricSchema.parse(file.rubric)

const label = (list: readonly { id: string; label: string }[], id: string) => list.find((item) => item.id === id)?.label ?? id
const answerLabel = (answer: FollowupAnswer) =>
  answer.type === 'new_information'
    ? label(followup.type === 'new_information' ? followup.responses : [], answer.response_id)
    : `${label(followup.type === 'economy_risk' ? followup.postures : [], answer.posture_id)} + ${label(
        followup.type === 'economy_risk' ? followup.priorities : [],
        answer.priority_id,
      )}`
const evidence = brief.evidence.map((e) => e.id)
const pairs: [string, string][] = []
evidence.forEach((first, i) => evidence.slice(i + 1).forEach((second) => pairs.push([first, second])))
const answers = publishedFollowupAnswers(followup)

interface Row {
  readonly actionId: string
  readonly qualifierId: string
  readonly action: string
  readonly qualifier: string
  readonly evidence: string
  readonly evidenceIds: readonly [string, string]
  readonly followupId: string
  readonly followup: string
  readonly total: number
  readonly components: { readonly main: number; readonly evidence: number; readonly followup: number }
}

const rows: Row[] = []
for (const action of brief.actions) {
  for (const qualifierId of action.qualifierIds) {
    for (const pair of pairs) {
      for (const answer of answers) {
        const main = { action_id: action.id, qualifier_id: qualifierId, evidence_ids: pair, confidence_id: brief.confidence[0]?.id ?? 'guessing' }
        const input = scoringInputFor(rubric, main, answer)
        if (!input) throw new Error(`unscoreable: ${JSON.stringify({ main, answer })}`)
        const result = scoreDecision(input)
        rows.push({
          actionId: action.id,
          qualifierId,
          action: action.label,
          qualifier: label(brief.qualifiers, qualifierId),
          evidence: pair.map((id) => label(brief.evidence, id)).join(' + '),
          evidenceIds: pair,
          followupId: followupKey(answer),
          followup: answerLabel(answer),
          total: result.total,
          components: result.components,
        })
      }
    }
  }
}

const findings = followupMatrixFindings(brief, rubric, answers)
const bestLine = bestLineByAction(brief, mainLineQualities(rubric))

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ caseId, rows, findings }))
  process.exit(0)
}

const totals = rows.map((r) => r.total).sort((a, b) => a - b)
const pct = (p: number) => totals[Math.min(totals.length - 1, Math.floor(p * totals.length))]
console.log(
  `${caseId}: ${rows.length} combinations; min ${totals[0]}, p25 ${pct(0.25)}, median ${pct(0.5)}, p75 ${pct(0.75)}, max ${totals.at(-1)}; 100s: ${rows.filter((r) => r.total === 100).length}`,
)

console.log('\nMain call (best total per line):')
const best = new Map<string, number>()
for (const r of rows) best.set(`${r.action} / ${r.qualifier}`, Math.max(best.get(`${r.action} / ${r.qualifier}`) ?? 0, r.total))
for (const [line, value] of [...best.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(value).padStart(3)}  ${line}`)

// For each locked action: its best qualifier and best evidence pair, then every follow-up answer.
const strongest = (actionId: string) =>
  rows
    .filter((r) => r.actionId === actionId)
    .reduce((top, r) => (r.components.main + r.components.evidence > top.components.main + top.components.evidence ? r : top))
const rowFor = (actionId: string, followupId: string) => {
  const anchor = strongest(actionId)
  return rows.find(
    (r) =>
      r.actionId === actionId &&
      r.qualifierId === anchor.qualifierId &&
      r.evidenceIds.join() === anchor.evidenceIds.join() &&
      r.followupId === followupId,
  )
}
const answerIds = answers.map((answer) => followupKey(answer))
const width = Math.max(...answerIds.map((id) => rowFor(brief.actions[0]?.id ?? '', id)?.followup.length ?? 0))

console.log('\nFollow-up against the locked line (best qualifier and evidence pair for that line):')
for (const action of brief.actions) {
  const anchor = strongest(action.id)
  console.log(`  locked: ${action.label} / ${anchor.qualifier}  (main ${anchor.components.main}/50, evidence ${anchor.components.evidence}/20)`)
  const scored = answerIds
    .map((id) => rowFor(action.id, id))
    .filter((row): row is Row => row !== undefined)
    .sort((a, b) => b.total - a.total)
  for (const row of scored) {
    console.log(`    ${row.followup.padEnd(width)}  follow-up ${String(row.components.followup).padStart(2)}/30  total ${String(row.total).padStart(3)}`)
  }
}

// Named stress lines, when the follow-up asks for "the line now" (responses now_<actionId>).
const ranked = [...brief.actions].sort((a, b) => (bestLine.get(b.id) ?? 0) - (bestLine.get(a.id) ?? 0))
const lineNow = (actionId: string) => `now_${actionId}`
if (ranked.length >= 3 && ranked.every((action) => answerIds.includes(lineNow(action.id)))) {
  const [good, alternative] = ranked
  const weak = ranked.at(-1)
  if (good && alternative && weak) {
    const weakBest = answerIds
      .map((id) => rowFor(weak.id, id))
      .filter((row): row is Row => row !== undefined)
      .reduce((top, row) => (row.total > top.total ? row : top))
    const stress: readonly [string, Row | undefined][] = [
      ['good main -> stays with it', rowFor(good.id, lineNow(good.id))],
      ['good main -> unnecessary reversal', rowFor(good.id, lineNow(alternative.id))],
      ['weak main -> best correction', weakBest],
      ['weak main -> stubborn continuation', rowFor(weak.id, lineNow(weak.id))],
      ['plausible alternative -> stays with it', rowFor(alternative.id, lineNow(alternative.id))],
    ]
    console.log('\nStress lines:')
    for (const [name, row] of stress) {
      if (!row) continue
      console.log(
        `  ${name.padEnd(40)} ${String(row.total).padStart(3)}  (follow-up ${String(row.components.followup).padStart(2)}/30: ${row.action} -> ${row.followup})`,
      )
    }
  }
}

console.log('\nFollow-up checks:')
if (findings.length === 0) console.log('  no findings')
for (const finding of findings) console.log(`  ${finding.severity} [${finding.code}] ${finding.message}`)
