# Roundcraft case content

Every case lives in one reviewable JSON file. Nothing is written into D1 by hand: production cases arrive only through migrations generated from these files.

```
content/cases/<case-id>.json      production cases (draft → ready → withdrawn)
content/fixtures/<id>.json        technical fixtures: local preview and tests only
scripts/content/                  validator, generator, preview, editorial schema
migrations/NNNN_publish_*.sql     generated, append-only, never edited
```

## Where drafts come from

Drafts can be written by hand or generated from real CS2 demos by the offline case miner in [`tools/case-miner/`](../tools/case-miner/README.md): it registers a demo with a provenance manifest (`content/sources/`), mines ranked decision candidates, separates what the deciding team could know from the demo's ground truth, and writes a `draft` case plus a reviewer packet. Generated drafts are demo-grounded synthetic cases (`origin: synthetic`): the round inspires the scenario, but the case never claims to reproduce the match and never names players or teams. Their options, debrief and rubric are heuristic proposals listed in `editorial.notes` and `editorial.knownIssues`; they follow exactly the same review workflow below.

## Case file format

```jsonc
{
  "caseId": "case_example_001",          // = file name; also cases.case_id
  "origin": "synthetic",                 // or "professional" (needs provenance + rights)
  "fixture": true,                       // fixtures only; can never be published
  "editorial": {                         // never leaves the repository
    "status": "draft",                   // draft | technically_validated | tactically_reviewed | ready | withdrawn
    "revision": "cr_example_001",        // = caseRevision in all four payloads
    "rubricRevision": "rr_example_001",  // = rubric.rubricRevision
    "author": "Name",
    "reviewers": [{ "name": "…", "reviewedAt": "2026-10-01", "verdict": "approved", "notes": "…" }],
    "references": [{ "label": "…", "detail": "…", "kind": "background_reading" }],
    "knownIssues": ["…"],
    "notes": "…",
    "provenance": "…", "rights": "…"     // required for origin "professional"
  },
  "edition": {                           // becomes the editions row
    "editionId": "ed_example_001",       // = brief.editionId
    "releaseAt": "2026-10-01T06:00:00.000Z",   // null until scheduled; exact ms format
    "officialEndAt": "2026-10-02T06:00:00.000Z",
    "graceEndAt": "2026-10-02T18:00:00.000Z",
    "publicMetadata": { "case_number": 1, "edition_date_utc": "2026-10-01",
      "estimated_minutes": 7, "focus": "…", "origin_label": "…" }
  },
  "brief": {}, "followup": {}, "reveal": {}, "rubric": {}   // exactly the D1 payloads
}
```

`brief`, `followup`, `reveal` and `rubric` are stored verbatim (canonical, key-sorted JSON) in `case_public_briefs`, `case_followups`, `case_reveals` and `case_rubrics`, and are validated with the same Zod schemas the Worker uses (`src/domain`). The `editorial` block and the schedule are validated by `scripts/content/schema.ts`.

The origin label for synthetic cases must be exactly `Synthetic scenario — editorial tactical analysis.`; a professional case needs an event/ruleset/provenance label, non-empty `editorial.provenance` and `editorial.rights`, and never the synthetic label.

## Workflow

1. **Author** a new `content/cases/<case-id>.json` with `status: "draft"`. Start from `content/fixtures/case_smoke_001.json` for the shape, not for the tactics.
2. **Validate**: `npm run content:validate` (`-- --case <id>` for one file). Fix every error. Drafts are reported as a readiness list and do not fail the run; anything at `technically_validated` or above, and every fixture, does. Set `technically_validated` once the report is clean.
3. **Human tactical review.** Someone other than the author reads the case against the checklist below and records the outcome in `editorial.reviewers` (`verdict: approved` or `changes_requested`, with notes). Reviewer name must differ from the author. The architecture calls for two independent reviews; one is enforced, fewer than two warns. Set `tactically_reviewed`.
4. **Preview**: `npm run content:preview -- <id>` loads the case into the local D1 database with a window covering now (idempotent; refuses `--remote`). Run `npm run dev` and play it through: main call, follow-up, reveal, and try several different lines.
5. **Schedule and mark ready**: set `releaseAt` / `officialEndAt` / `graceEndAt` (`release < officialEnd <= graceEnd`, UTC with milliseconds), `edition_date_utc`, and `status: "ready"`. Official windows of ready cases must not overlap.
6. **Build**: `npm run content:build` writes `migrations/NNNN_publish_<case-id>_<revision>.sql` for each ready case that has none yet. Commit the case file and the migration together.
7. **PR → merge to `main`.** CI runs `content:validate` and `content:build -- --check`, then applies the migration to production (`wrangler d1 migrations apply --remote`). The migration inserts a `locked` revision and a `released` edition; the Worker serves it inside its window.

`content:build -- --check` (CI) fails if a ready case has no migration, if a generated migration's checksum no longer matches the case JSON, if a published case is edited back to a non-ready status, or if a published case file disappears.

## Immutability, withdrawal and revision

- A published revision is locked. Editing its payloads breaks `content:build -- --check`; the checksum (SHA-256 of the canonical JSON of the four payloads) is embedded in the migration header and in `case_revisions.checksum`. Editorial-only edits (`editorial`, notes, references) are allowed.
- **Withdraw**: set `editorial.status` to `withdrawn`, run `npm run content:build`, commit the generated `NNNN_withdraw_*.sql`. It sets the edition to `withdrawn` and the revision to `withdrawn`. Never delete a published case file.
- **Revise / correct**: a revision is never changed in place. Withdraw the published case, then add the corrected version as a new case file with a new `caseId`, `revision`, `rubricRevision` and `editionId`. Explain the correction in `editorial.notes`.
- Never edit a generated migration by hand and never add remote-writing shortcuts: production changes only happen through merged migrations.

## Fixtures

`content/fixtures/` holds technical fixtures ("The last smoke") used for local preview and tests. They are marked `"fixture": true`, may not be `ready`, are refused by `content:build`, and have deliberately generic test data with no tactical claims. A fixture is validated on every run like a production case.

## Editorial review checklist

Tactical plausibility
- [ ] Economy, weapons and prices are consistent with current CS2 rules; loss bonus and side (T/CT) make sense.
- [ ] Timings, callouts, player counts, alive players and utility inventory are stated or unambiguous, and do not contradict each other or the follow-up and reveal.
- [ ] Every option offered is playable on the player's side in that situation.

Information design
- [ ] Each fact status is honest: `confirmed`, `last_seen` (with an age), `inferred` (with a stated basis) or `unknown`. Information ages are meaningful.
- [ ] Nothing in the brief gives away the follow-up or reveal (the validator checks 6-word overlaps; read for paraphrase too).

Decision quality
- [ ] At least two defensible lines exist and the distractors are plausible, not obviously silly. The best line is not always the first option.
- [ ] The follow-up genuinely changes the reasoning and has a defensible best answer.
- [ ] The rubric rewards reasoning: evidence pairs and qualifiers are scored for a reason, not padded.

Reveal
- [ ] The continuation is consistent with the disclosed state; the counterfactual changes exactly one fact; the strongest alternative is fair.
- [ ] A transferable principle a player can apply to a different map or round.

Provenance and rights
- [ ] Origin is honest. Synthetic cases claim nothing about real matches; background reading goes in `editorial.references`, not in the reveal as if it were the source.
- [ ] No real players or teams appear unless rights are recorded in `editorial.rights`.

## Follow-up scoring

The follow-up is worth 30 of the 100 points and is judged against the line the player locked. The rubric (`schemaVersion: 2`) therefore keys every follow-up cell by main action:

```jsonc
"followup": {
  "type": "new_information",
  "responses": [
    { "actionId": "retake", "responseId": "keep_retaking", "quality": 100 },   // a sound line the update leaves sound
    { "actionId": "retake", "responseId": "save_now", "quality": 20 },         // abandoning it
    { "actionId": "save", "responseId": "keep_retaking", "quality": 70 },      // correcting a weaker call
    { "actionId": "save", "responseId": "save_now", "quality": 25 }            // holding on to it
  ]
}
```

`economy_risk` pairs carry `actionId` the same way. The qualifier does not change the follow-up score: execution detail is scored in the main call. Write the cells row by row: when is staying with this line coherent, when is changing justified, and does the new information really support a reversal? `npm run content:score -- <case-id>` prints each locked line against every answer, the named stress lines (a good call kept or needlessly reversed, a weak call corrected or kept, a plausible alternative kept) and the follow-up checks below.

## Validator rules (errors unless noted)

Payloads parse with the domain schemas · one revision id across the four payloads and `editorial.revision` · `brief.editionId` matches the edition · every main cell references a published action and one of its qualifiers, and every published action × qualifier has a cell · every action has all 10 evidence pairs exactly once · follow-up rubric has exactly one cell per published action × follow-up answer (response, or posture × priority pair), matches the follow-up type, and does not score every answer the same after every action · reveal evidence ids exist in the brief · **every** main answer × evidence pair × follow-up answer is scoreable, with components in range and summing to 0–100 · at least one main line reaches Best-supported (quality 90 or more) · no 6-word sequence shared between the brief and the follow-up or reveal · origin honesty · status gating (reviewer approval, schedule, fixture never ready) · no overlapping official windows · unique identifiers across files.
Warnings: best-scoring action is the first listed, fewer than two defensible actions, no `inferred`/`unknown` fact, `last_seen` fact without an age, a locked action whose follow-up answers differ by less than 20 points, a follow-up answer that scores high and nearly the same after actions of clearly different quality, a single review, unresolved change requests, known issues on a ready case.

## Runtime requirement

The scripts run on Node 22 with native type stripping (Node 22.18 or newer), through `scripts/content/register.mjs`, which lets the app's extensionless `src/domain` imports resolve. No extra dependencies.
