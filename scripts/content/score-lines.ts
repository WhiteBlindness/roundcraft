// Scores every (action, qualifier, evidence pair, follow-up answer) of a case with the production
// scoring code, so rubric proposals can be stress-tested before tactical review.
// Usage: node --no-warnings=ExperimentalWarning --import ./scripts/content/register.mjs scripts/content/score-lines.ts <case-id> [--json]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { scoreDecision } from '../../src/domain/scoring'
import { publishedFollowupAnswers, scoringInputFor, serverRubricSchema } from '../../src/domain/server-rubric'

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
const rubric = serverRubricSchema.parse(file.rubric)
const brief = file.brief
const label = (list: { id: string; label: string }[], id: string) => list.find((item) => item.id === id)?.label ?? id
const evidence: string[] = brief.evidence.map((e: { id: string }) => e.id)
const pairs: [string, string][] = []
evidence.forEach((first, i) => evidence.slice(i + 1).forEach((second) => pairs.push([first, second])))
const followupAnswers = publishedFollowupAnswers(file.followup)

const rows = []
for (const action of brief.actions) {
  for (const qualifierId of action.qualifierIds) {
    for (const pair of pairs) {
      for (const followup of followupAnswers) {
        const main = { action_id: action.id, qualifier_id: qualifierId, evidence_ids: pair, confidence_id: brief.confidence[0].id }
        const input = scoringInputFor(rubric, main, followup)
        if (!input) throw new Error(`unscoreable: ${JSON.stringify({ main, followup })}`)
        const result = scoreDecision(input)
        rows.push({
          action: action.label,
          qualifier: label(brief.qualifiers, qualifierId),
          evidence: pair.map((id) => label(brief.evidence, id)).join(' + '),
          followup: 'response_id' in followup ? label(file.followup.responses, followup.response_id) : JSON.stringify(followup),
          total: result.total,
          components: result.components,
        })
      }
    }
  }
}
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows))
} else {
  const totals = rows.map((r) => r.total).sort((a, b) => a - b)
  const pct = (p: number) => totals[Math.min(totals.length - 1, Math.floor(p * totals.length))]
  console.log(`${caseId}: ${rows.length} combinations; min ${totals[0]}, p25 ${pct(0.25)}, median ${pct(0.5)}, p75 ${pct(0.75)}, max ${totals.at(-1)}; 100s: ${rows.filter((r) => r.total === 100).length}`)
  const best = new Map<string, number>()
  for (const r of rows) best.set(`${r.action} / ${r.qualifier}`, Math.max(best.get(`${r.action} / ${r.qualifier}`) ?? 0, r.total))
  for (const [line, value] of [...best.entries()].sort((a, b) => b[1] - a[1])) console.log(`  best ${String(value).padStart(3)}  ${line}`)
  const followupPoints = new Map<string, Set<number>>()
  for (const r of rows) {
    const points = followupPoints.get(r.followup) ?? new Set<number>()
    points.add(r.components.followup)
    followupPoints.set(r.followup, points)
  }
  for (const [answer, points] of followupPoints) {
    const values = [...points].sort((a, b) => a - b)
    const range = values.length === 1 ? `${values[0]}` : `${values[0]}-${values.at(-1)}`
    console.log(`  follow-up ${range.padStart(5)} / 30  ${answer}`)
  }
}
