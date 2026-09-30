# Roundcraft case miner

Offline editorial tooling that turns Counter-Strike 2 demo files into ranked decision **candidates** and Roundcraft case **drafts**. It feeds the existing content pipeline (`content/README.md`); it never publishes anything and never runs in production.

```
source demo ──► manifest (committed) + demo (data-local, ignored)
      │
      ▼  parse
ground truth: anonymised rounds, 0.5 s frames, kills, utility, bomb events
      │
      ▼  mine
player-known view per decision point ─► detectors ─► follow-up ─► score ─► candidate bundle
      │                                                                        │
      ▼  render                                                                ▼  case draft
player-known.svg · ground-truth.svg (reviewer only)            content/cases/<id>.json  (status: draft)
                                                                review.md next to the candidate
      │
      ▼  existing pipeline
npm run content:validate → human tactical review → content:preview → ready → content:build
```

## Setup

Python 3.11+ and [uv](https://docs.astral.sh/uv/) (or plain `pip`).

```bash
cd tools/case-miner
uv venv && . .venv/bin/activate
uv pip install -e ".[dev]"
```

Dependencies: `demoparser2` (MIT, the CS2 demo parser) and `pandas`. Nothing else; diagrams are plain SVG.

## Commands

```bash
roundcraft-miner source add match.dem --id src_mirage_example --metadata meta.json
roundcraft-miner source list
roundcraft-miner run src_mirage_example              # parse + mine + render
roundcraft-miner candidates list --map de_mirage --min-score 0.75
roundcraft-miner candidate show cand_4fb7d60bb4c5
roundcraft-miner candidate render cand_4fb7d60bb4c5
roundcraft-miner case draft cand_4fb7d60bb4c5         # writes content/cases/<id>.json and runs content:validate
roundcraft-miner case packet case_mirage_post_plant_4fb7d6   # human review packet under content/review/<id>/
```

`mine` and `run` keep at most two candidates per round and side; `--cap 6` keeps more, which is useful when re-mining after a detector change so an existing draft's candidate is not dropped.

`meta.json` for `source add` holds `acquisition`, `match`, `licence`, `contentLane` and `provenanceNote`. See `content/sources/*.json` for examples and [`docs/content-sources.md`](docs/content-sources.md) for which sources are allowed.

Then, from the repository root, the normal pipeline takes over:

```bash
npm run content:validate -- --case <case-id>
npm run content:preview -- <case-id>
```

## Data layout

| Path | Contents | Committed |
| --- | --- | --- |
| `content/sources/<source-id>.json` | Provenance: acquisition, licence, lane, demo SHA-256, parser version | Yes |
| `data-local/demos/<source-id>.dem` | Raw demo | No |
| `data-local/parsed/<source-id>/match.json` | Ground truth, anonymised (`p01`..`p10`) | No |
| `data-local/candidates/<source-id>/<candidate-id>/` | `candidate.json`, `player-known.svg`, `ground-truth.svg`, `review.md` | No |
| `content/cases/<case-id>.json` | Generated drafts (`status: draft`, `origin: synthetic`) | Yes, once reviewed for commit |

Player names, Steam IDs, clan tags and server names are dropped during parsing. Tests fail if a Steam ID appears in any committed manifest or case, or if a raw demo is tracked.

## Information model: ground truth vs player-known

A demo knows everything; the deciding team does not. Every candidate carries two separate layers:

- **`groundTruth`** — true enemy positions, timelines before and after, the outcome. Used for the reveal (*What actually happened*) and for the reviewer. Never used to build a brief.
- **`playerKnown`** — what the perspective team could know at the decision tick, built only from frames and events at or before that tick:
  - own team: positions, health, weapons, utility, money, kits (all confirmed);
  - alive counts and clocks (HUD, confirmed);
  - an enemy is **confirmed** if a living teammate's radar-visibility (`m_bSpottedByMask`) included them within the last 2 s, **last seen** (with its age, up to 45 s) if earlier, otherwise **unknown** with no position at all;
  - bomb: always known to T; known to CT once planted, or where the carrier was spotted;
  - enemy smokes and molotovs only when a living teammate was within 1,800 units of them;
  - **inferred** facts only from public information (e.g. the enemy's loss streak on the scoreboard).

This is conservative: radar visibility undercounts what a player notices by sound and comms, so briefs err towards *unknown*. The brief generator reads only `playerKnown`; tests prove that ground-truth-only positions never reach a brief, evidence label or follow-up.

## Candidate detection and ranking

Detectors (per round, per side): `post_plant`, `late_round_no_plant`, `economy_save`, `rotation_read`, `low_utility_attack`, `man_advantage_shift`, `opening_pick`. Each candidate gets a follow-up: the first event 3–25 s later that changes what the team knows (a new sighting, a kill, a plant or defuse, observed utility).

The editorial-interest score (0–1) is a weighted mean of: ambiguity (near-equal numbers, several defensible lines), stakes, incompleteness of information, time pressure, presentability, follow-up quality, not an aim duel, and transferability. Weights and thresholds live in `roundcraft_miner/mine/scoring.py`. Candidate ids are hashes of the demo and the decision point, so they are stable across re-runs.

## Drafts are proposals

`case draft` fills the full Roundcraft case format so the validator can run, but:

- the option set, debrief reasoning and principle are **templates per situation family**, not tactical truth;
- the rubric is a **heuristic proposal** whose every rule is listed in `editorial.notes`;
- the historical line from the demo is the reveal, never the answer key;
- every uncertainty is listed in `editorial.knownIssues`.

A draft only moves to `technically_validated` and `tactically_reviewed` through the existing human workflow.

## Reviewing a candidate

Open `data-local/candidates/<source>/<candidate>/review.md`. It has the summary, score factors, player-known facts, follow-up, the historical line, disputed assumptions, alternative lines, validation results and both diagrams. The reviewer's job is to decide whether the decision is real, fix the options and rubric, and record the review in `editorial.reviewers`. They should not need to open the demo, but can: `candidate.json` has exact ticks.

## Review packets

`case packet [case-id ...]` writes `content/review/<case-id>/README.md` plus both diagrams for every case listed in `content/review/questions.json` (or the ids given). A packet is what a CS2 reviewer reads instead of the demo: the brief as players see it, the recent timeline, every proposed line scored with `npm run content:score`, the follow-up and its caveats, what happened next, assumptions and questions. Packets carry sides only, never identities; the writer refuses to save one that contains a pid or Steam ID. The ranked queue is [`docs/content-review-queue.md`](../../docs/content-review-queue.md).

## Tests

```bash
cd tools/case-miner && python -m pytest -q
```

Tests that need a local demo skip automatically when `data-local/` is empty (as in CI).
