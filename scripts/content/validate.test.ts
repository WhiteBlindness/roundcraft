import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { defaultRoot, loadCases } from './lib'
import { SYNTHETIC_ORIGIN_LABEL } from './schema'
import {
  WINDOW_A,
  WINDOW_B,
  asLoaded,
  fixtureJson,
  makeRoot,
  readyCase,
} from './test-helpers'
import type { Json } from './test-helpers'
import { runValidate, validateCase, validateCases } from './validate'

function codes(data: unknown, dir: 'cases' | 'fixtures' = 'fixtures', id = 'case_smoke_001') {
  const report = validateCase(asLoaded(data, id, dir))
  return {
    errors: report.errors.map(({ code }) => code),
    warnings: report.warnings.map(({ code }) => code),
    report,
  }
}

function mutated(change: (draft: Json) => void): Json {
  const draft = fixtureJson()
  change(draft)
  return draft
}

describe('technical fixture', () => {
  it('passes with no errors or warnings, and is never publishable', () => {
    const { errors, warnings, report } = codes(fixtureJson())

    expect(errors).toEqual([])
    expect(warnings).toEqual([])
    expect(report.publishable).toBe(false)
    expect(report.enforced).toBe(true)
  })

  it('has at least two well-scoring main lines that are not just the first option', () => {
    const fixture = fixtureJson()
    const main = fixture.rubric.main as { actionId: string; ratings: Record<string, number> }[]
    const quality = (cell: (typeof main)[number]) =>
      (60 * cell.ratings.route_logic! + 40 * cell.ratings.utility_timing!) / 4
    const strongActions = new Set(main.filter((cell) => quality(cell) >= 90).map((cell) => cell.actionId))

    expect(strongActions.size).toBeGreaterThanOrEqual(2)
    expect(strongActions.has('b')).toBe(true)
  })
})

describe('repository content', () => {
  it('has a valid fixture and only drafts under content/cases', () => {
    const reports = validateCases(loadCases(defaultRoot()))
    const fixture = reports.find((report) => report.fixture)

    expect(fixture?.errors).toEqual([])
    for (const report of reports.filter((entry) => !entry.fixture)) {
      expect(report.status).toBe('draft')
      expect(report.publishable).toBe(false)
      expect(report.caseFile?.editorial.reviewers).toEqual([])
      expect(report.caseFile?.origin).toBe('synthetic')
    }
  })

  it('never claims professional origin for legacy drafts', () => {
    const directory = join(defaultRoot(), 'content', 'cases')
    for (const name of readdirSync(directory)) {
      const text = readFileSync(join(directory, name), 'utf8')
      expect(text).not.toMatch(/"origin": "professional"/)
    }
  })
})

describe('hard invariants', () => {
  const cases: readonly [string, (draft: Json) => void, string][] = [
    ['brief fails its domain schema', (d) => d.brief.evidence.push({ id: 'e6', label: 'Sixth' }), 'brief_schema'],
    ['follow-up fails its domain schema', (d) => { d.followup.responses = [] }, 'followup_schema'],
    ['reveal fails its domain schema', (d) => { d.reveal.principle = 'short' }, 'reveal_schema'],
    ['rubric fails its domain schema', (d) => { d.rubric.dimensions[0].weight = 10 }, 'rubric_schema'],
    ['a payload revision differs', (d) => { d.followup.caseRevision = 'other_revision' }, 'revision_mismatch'],
    ['rubric revision differs from the editorial one', (d) => { d.rubric.rubricRevision = 'other_rubric' }, 'rubric_revision_mismatch'],
    ['brief edition differs from edition.editionId', (d) => { d.brief.editionId = 'other_edition' }, 'edition_mismatch'],
    ['brief origin differs from the case origin', (d) => { d.brief.origin = 'professional' }, 'origin_mismatch'],
    ['a main cell uses a qualifier of another action', (d) => { d.rubric.main[0].qualifierId = 'q3' }, 'main_unknown_qualifier'],
    ['a main cell references an unpublished action', (d) => { d.rubric.main[0].actionId = 'zzz' }, 'main_unknown_action'],
    ['a published action×qualifier has no main cell', (d) => { d.rubric.main.pop() }, 'main_incomplete'],
    ['an evidence pair is missing', (d) => { d.rubric.evidence.shift() }, 'evidence_incomplete'],
    ['an evidence pair is duplicated', (d) => { d.rubric.evidence.push({ ...d.rubric.evidence[0] }) }, 'evidence_duplicate'],
    ['an evidence cell uses an unknown id', (d) => { d.rubric.evidence[0].evidenceIds = ['e1', 'nope'] }, 'evidence_unknown_id'],
    ['a follow-up response has no rubric cell', (d) => { d.followup.responses.push({ id: 'third', label: 'A third option' }) }, 'followup_incomplete'],
    ['the rubric covers an unpublished follow-up response', (d) => { d.rubric.followup.responses.push({ actionId: 'a', responseId: 'ghost', quality: 10 }) }, 'followup_extra'],
    ['rubric follow-up type differs', (d) => { d.rubric.followup = { type: 'economy_risk', pairs: [{ actionId: 'a', postureId: 'x', priorityId: 'y', quality: 50 }] } }, 'followup_type'],
    ['reveal references evidence missing from the brief', (d) => { d.reveal.debrief.evidenceReview[0].evidenceId = 'ghost' }, 'reveal_unknown_evidence'],
    ['no line reaches the Best-supported band', (d) => { d.rubric.main[0].ratings = { route_logic: 1, utility_timing: 1 }; d.rubric.main[2].ratings = { route_logic: 1, utility_timing: 1 } }, 'no_best_supported_line'],
    ['reveal repeats brief text (6 words)', (d) => { d.reveal.debrief.cost = 'Note: one defender was last seen at A twelve seconds ago.' }, 'disclosure_overlap'],
    ['follow-up repeats brief text (6 words)', (d) => { d.followup.stimulus = 'The remaining defenders are probably spread across both sites.' }, 'disclosure_overlap'],
    ['synthetic case uses another origin label', (d) => { d.edition.publicMetadata.origin_label = 'Based on a real match' }, 'origin_label'],
    ['synthetic case claims an observed continuation', (d) => { d.reveal.continuation.kind = 'observed' }, 'origin_observed'],
    ['fixture is marked ready', (d) => { d.editorial.status = 'ready' }, 'fixture_ready'],
    ['tactically reviewed without reviewers', (d) => { d.editorial.status = 'tactically_reviewed' }, 'review_missing'],
    ['reviewer is the author', (d) => {
      d.editorial.status = 'tactically_reviewed'
      d.editorial.reviewers = [{ name: ' roundcraft engineering (technical fixture) ', reviewedAt: '2026-09-01', verdict: 'approved', notes: '' }]
    }, 'review_missing'],
    ['reviewer requested changes only', (d) => {
      d.editorial.status = 'tactically_reviewed'
      d.editorial.reviewers = [{ name: 'Someone', reviewedAt: '2026-09-01', verdict: 'changes_requested', notes: '' }]
    }, 'review_missing'],
    ['schedule is out of order', (d) => { d.edition.releaseAt = '2027-01-02T00:00:00.000Z'; d.edition.officialEndAt = '2027-01-01T00:00:00.000Z'; d.edition.graceEndAt = '2027-01-03T00:00:00.000Z' }, 'schedule_order'],
    ['schedule uses a non-millisecond timestamp', (d) => { d.edition.releaseAt = '2027-01-01T00:00:00Z' }, 'invalid_envelope'],
  ]

  it.each(cases)('rejects: %s', (_name, change, code) => {
    const result = codes(mutated(change))

    expect(result.errors).toContain(code)
    expect(result.report.enforced).toBe(true)
  })

  it('accepts a review from someone other than the author', () => {
    const data = mutated((d) => {
      d.editorial.status = 'tactically_reviewed'
      d.editorial.reviewers = [{ name: 'Reviewer One', reviewedAt: '2026-09-01', verdict: 'approved', notes: 'ok' }]
    })

    expect(codes(data).errors).toEqual([])
    expect(codes(data).warnings).toContain('single_review')
  })

  it('requires provenance and rights for professional cases', () => {
    const professional = (d: Json) => {
      d.origin = 'professional'
      d.brief.origin = 'professional'
      d.edition.publicMetadata.origin_label = 'Event, ruleset and sources are listed below'
    }
    const bare = codes(mutated(professional))
    const documented = codes(
      mutated((d) => {
        professional(d)
        d.editorial.provenance = 'Recorded demo, event X, map Y, round 12'
        d.editorial.rights = 'Cleared with the organiser on 2026-09-01'
      }),
    )

    expect(bare.errors).toEqual(expect.arrayContaining(['provenance_missing', 'rights_missing']))
    expect(documented.errors).toEqual([])
  })

  it('rejects a professional case that reuses the synthetic label', () => {
    const data = mutated((d) => {
      d.origin = 'professional'
      d.brief.origin = 'professional'
      d.editorial.provenance = 'x'
      d.editorial.rights = 'y'
    })

    expect(codes(data).errors).toContain('origin_label')
  })

  it('rejects a ready case without a schedule and a ready fixture', () => {
    const data = readyCase('cand_001', WINDOW_A, (d) => {
      d.edition.releaseAt = null
    })

    expect(codes(data, 'cases', 'case_cand_001').errors).toContain('schedule_missing')
  })

  it('reports fixtures placed in content/cases and vice versa', () => {
    expect(codes(fixtureJson(), 'cases').errors).toContain('fixture_flag')
    const notFixture = mutated((d) => { delete d.fixture })

    expect(codes(notFixture, 'fixtures').errors).toContain('fixture_flag')
  })

  it('requires the case id to match the file name', () => {
    expect(codes(fixtureJson(), 'fixtures', 'other_name').errors).toContain('case_id_mismatch')
  })

  it('accepts a complete ready case', () => {
    const { errors, report } = codes(readyCase('cand_001', WINDOW_A), 'cases', 'case_cand_001')

    expect(errors).toEqual([])
    expect(report.publishable).toBe(true)
  })

  it('scores every answer combination for an economy_risk follow-up too', () => {
    const data = mutated((d) => {
      d.followup = {
        schemaVersion: 1,
        caseRevision: d.editorial.revision,
        type: 'economy_risk',
        heading: 'Budget',
        stimulus: 'Money is tight.',
        updates: [{ id: 'money', status: 'new', text: 'Funds are low.' }],
        postures: [{ id: 'safe', label: 'Safe' }, { id: 'bold', label: 'Bold' }],
        priorities: [{ id: 'now', label: 'Now' }, { id: 'later', label: 'Later' }],
      }
      const pairs = ['safe|now', 'safe|later', 'bold|now', 'bold|later']
      d.rubric.followup = {
        type: 'economy_risk',
        pairs: ['a', 'b', 'c'].flatMap((actionId, actionIndex) =>
          pairs.map((pair, index) => {
            const [postureId, priorityId] = pair.split('|')
            return { actionId, postureId, priorityId, quality: 90 - ((index + actionIndex) % 4) * 20 }
          }),
        ),
      }
    })

    expect(codes(data).errors).toEqual([])
    const missing = mutated((d) => {
      d.followup = data.followup
      d.rubric.followup = { type: 'economy_risk', pairs: data.rubric.followup.pairs.slice(1) }
    })

    expect(codes(missing).errors).toEqual(expect.arrayContaining(['followup_incomplete', 'scoring_incomplete']))
  })

  it('reports unscoreable combinations as a single scoring error', () => {
    const { report } = codes(mutated((d) => { d.rubric.evidence.shift() }))
    const scoring = report.errors.filter(({ code }) => code === 'scoring_incomplete')

    expect(scoring).toHaveLength(1)
    expect(scoring[0]?.message).toMatch(/of 120 answer combinations cannot be scored/)
  })

  it('rejects malformed JSON and unknown envelope fields', () => {
    const broken = validateCase({ id: 'x', file: 'content/cases/x.json', dir: 'cases', parseError: 'Unexpected token' })
    const extra = codes(mutated((d) => { d.surprise = true }))

    expect(broken.errors[0]?.code).toBe('invalid_json')
    expect(broken.enforced).toBe(true)
    expect(extra.errors).toContain('invalid_envelope')
  })
})

describe('warnings', () => {
  it('warns when the best action is the first listed', () => {
    const data = mutated((d) => {
      d.rubric.main[2].ratings = { route_logic: 1, utility_timing: 1 }
      d.rubric.main[3].ratings = { route_logic: 1, utility_timing: 1 }
    })

    expect(codes(data).warnings).toContain('best_action_first')
    expect(codes(data).errors).toEqual([])
  })

  it('warns when nothing is inferred or unknown', () => {
    const data = mutated((d) => { d.brief.facts.pop() })

    expect(codes(data).warnings).toContain('no_uncertain_fact')
  })

  it('warns about a last_seen fact without an age', () => {
    const data = mutated((d) => { d.brief.facts[1].text = 'One defender was last seen at A.' })

    expect(codes(data).warnings).toContain('last_seen_without_age')
  })

  it('warns when fewer than two actions are defensible', () => {
    const data = mutated((d) => {
      d.rubric.main[0].ratings = { route_logic: 1, utility_timing: 1 }
      d.rubric.main[1].ratings = { route_logic: 1, utility_timing: 1 }
    })

    expect(codes(data).warnings).toContain('single_defensible_action')
  })

  it('rejects a main action without follow-up cells', () => {
    const data = mutated((d) => {
      d.rubric.followup.responses = d.rubric.followup.responses.filter(({ actionId }: { actionId: string }) => actionId !== 'c')
    })

    expect(codes(data).errors).toEqual(expect.arrayContaining(['followup_incomplete', 'scoring_incomplete']))
  })

  it('rejects a follow-up that scores every answer the same after every main action', () => {
    const data = mutated((d) => {
      for (const cell of d.rubric.followup.responses) cell.quality = cell.responseId === 'change_mid' ? 90 : 60
    })

    expect(codes(data).errors).toContain('followup_ignores_main_call')
  })

  it('warns when an answer scores high and alike after main actions of different quality', () => {
    const data = mutated((d) => {
      d.rubric.main = d.rubric.main.map((cell: { actionId: string }) => ({
        ...cell,
        ratings: cell.actionId === 'a' ? { route_logic: 4, utility_timing: 4 } : { route_logic: 2, utility_timing: 2 },
      }))
      for (const cell of d.rubric.followup.responses) {
        if (cell.responseId === 'change_mid') cell.quality = cell.actionId === 'a' ? 90 : 88
      }
    })
    const { warnings } = codes(data)

    expect(warnings).toContain('followup_context_blind')
    expect(codes(mutated(() => undefined)).warnings).not.toContain('followup_context_blind')
  })

  it('warns when the follow-up barely changes the score', () => {
    const data = mutated((d) => { d.rubric.followup.responses[0].quality = 85 })

    expect(codes(data).warnings).toContain('followup_flat')
  })

  it('warns about a synthetic-only date mismatch and unresolved change requests', () => {
    const data = readyCase('cand_001', WINDOW_A, (d) => {
      d.edition.publicMetadata.edition_date_utc = '2026-01-01'
      d.editorial.reviewers.push({ name: 'Reviewer One', reviewedAt: '2026-09-03', verdict: 'changes_requested', notes: 'wait' })
    })
    const { warnings } = codes(data, 'cases', 'case_cand_001')

    expect(warnings).toEqual(expect.arrayContaining(['edition_date', 'changes_requested']))
  })
})

describe('cross-case rules', () => {
  const load = (entries: Record<string, Json>) =>
    Object.entries(entries).map(([id, data]) => asLoaded(data, id, 'cases'))

  it('rejects overlapping official windows between ready cases', () => {
    const reports = validateCases(
      load({
        case_one_001: readyCase('one_001', WINDOW_A),
        case_two_001: readyCase('two_001', { ...WINDOW_B, releaseAt: '2027-01-02T00:00:00.000Z' }),
      }),
    )

    for (const report of reports) {
      expect(report.errors.map(({ code }) => code)).toContain('edition_overlap')
      expect(report.publishable).toBe(false)
    }
  })

  it('allows back-to-back windows', () => {
    const reports = validateCases(
      load({
        case_one_001: readyCase('one_001', WINDOW_A),
        case_two_001: readyCase('two_001', WINDOW_B),
      }),
    )

    expect(reports.every((report) => report.errors.length === 0 && report.publishable)).toBe(true)
  })

  it('rejects duplicate identifiers across files', () => {
    const first = readyCase('one_001', WINDOW_A)
    const second = readyCase('two_001', WINDOW_B)
    second.edition.editionId = first.edition.editionId
    second.brief.editionId = first.edition.editionId
    const reports = validateCases(load({ case_one_001: first, case_two_001: second }))

    expect(reports.every((report) => report.errors.some(({ code }) => code === 'duplicate_identifier'))).toBe(true)
  })
})

describe('runValidate exit code', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function run(files: Record<string, unknown>, args: string[] = []) {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    return runValidate(args, makeRoot(files))
  }

  const brokenDraft = () => {
    const data = readyCase('draft_001', WINDOW_A, (d) => {
      d.editorial.status = 'draft'
      d.rubric.evidence.shift()
    })
    return data
  }

  it('does not fail for a draft with errors', () => {
    expect(run({ 'content/cases/case_draft_001.json': brokenDraft(), 'content/fixtures/case_smoke_001.json': fixtureJson() })).toBe(0)
  })

  it('fails for a technically validated case with errors', () => {
    const data = brokenDraft()
    data.editorial.status = 'technically_validated'

    expect(run({ 'content/cases/case_draft_001.json': data })).toBe(1)
  })

  it('fails for a broken fixture', () => {
    expect(run({ 'content/fixtures/case_smoke_001.json': mutated((d) => { d.rubric.evidence.shift() }) })).toBe(1)
  })

  it('supports --case and rejects unknown ids', () => {
    const files = {
      'content/cases/case_draft_001.json': (() => {
        const data = brokenDraft()
        data.editorial.status = 'ready'
        return data
      })(),
      'content/fixtures/case_smoke_001.json': fixtureJson(),
    }

    expect(run(files, ['--case', 'case_smoke_001'])).toBe(0)
    expect(run(files, ['--case', 'case_draft_001'])).toBe(1)
    expect(run(files, ['--case', 'missing'])).toBe(2)
  })

  it('uses the synthetic origin label mandated by the PRD', () => {
    expect(SYNTHETIC_ORIGIN_LABEL).toBe('Synthetic scenario — editorial tactical analysis.')
  })
})
