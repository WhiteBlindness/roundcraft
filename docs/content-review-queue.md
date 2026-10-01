# Content review queue

The ten mined drafts under `content/cases/` all pass the validator, but that only proves structure. This queue ranks them by how much a human tactical review is likely to be worth. It lists the five worth reviewing and the five to hold back.

Every case here is `draft`. The options, rubric and debrief are proposals from the draft generator, and no case has had human tactical review. Only a named human CS2 reviewer can move a case to `tactically_reviewed`, as the pipeline in [`content/README.md`](../content/README.md) describes.

The reviewer handoff for the first three cases is [`content/review/README.md`](../content/review/README.md).

## How to review one case (5–10 minutes)

1. Open the packet, `content/review/<case-id>/README.md`. It has seven sections:
   1. situation;
   2. what the deciding team knew;
   3. the main decision and how it scores;
   4. the follow-up, its timing and score matrix;
   5. what actually happened;
   6. questions;
   7. an approval form.
2. Optionally play it: run `npm run content:preview -- <case-id>`, then `npm run dev`, and open Today. Each preview makes that case today's case locally. It never touches production.
3. Fill in the approval form. The owner records the verdict in the case file's `editorial.reviewers` as `approved` or `changes_requested`, with notes.

Packets are regenerated with `roundcraft-miner case packet` from `content/review/questions.json`, which holds the summary, assumptions and questions for each case.

## Ranked queue

| Rank | Case | Situation | Action |
|---|---|---|---|
| 1 | `case_inferno_post_plant_356758` | CT 2v2 retake at A, 36 s, two kits, no utility | **REVIEW FIRST** |
| 2 | `case_inferno_late_round_no_plant_a430fd` | T 2v2, 35 s, bomb dropped at Top of Mid | **REVIEW FIRST** |
| 3 | `case_mirage_opening_pick_cae8a3` | T 5v4 after the opening kill, 74 s | **REVIEW FIRST** |
| 4 | `case_mirage_post_plant_4fb7d6` | CT 2v2 retake at A, 36 s, no kits, split team | **NEEDS TACTICAL DECISION** |
| 5 | `case_inferno_man_advantage_shift_927fb7` | CT 3v3 hold or rotate, 92 s, after a trade in Middle | **NEEDS TACTICAL DECISION** |
| – | `case_inferno_post_plant_182a79` | CT 3v4 retake on the pistol round | DROP |
| – | `case_mirage_late_round_no_plant_ecd6a2` | T 3v2 on the pistol round, two players on low HP | DROP |
| – | `case_inferno_economy_save_71be3f` | T 2v3 plant or save, 14 s, match point | DROP |
| – | `case_inferno_man_advantage_shift_6c2440` | CT 2v2 at match point, 84 s | DROP |
| – | `case_mirage_man_advantage_shift_e451c6` | T 2v3 after a trade, 78 s | DROP |

DROP means "do not spend expert time on it now". The files stay in the repository, and the owner decides whether to delete them.

The order changed once the follow-up was scored against the locked line. The Mirage 5v4 (`cae8a3`) moved up: it is now the one case where the follow-up tests a genuine change of mind. The Inferno 3v3 (`927fb7`) moved down: its follow-up row needs a reviewer to set it by hand.

## Review first

### 1. Inferno 2v2 retake at A: `case_inferno_post_plant_356758`

Two defenders in CT Spawn have 36 s left on a bomb planted at A. Both have kits and full armour, one holds an AWP, and the team has no utility. One attacker with an AK-47 was last seen in A site 14 s ago, and the planter's position is unknown. The brief is fully player-known. The follow-up, an enemy smoke in Balcony, is an attacker action rather than something the defenders stumble into.

- Preview: `npm run content:preview -- case_inferno_post_plant_356758`
- Packet: [`content/review/case_inferno_post_plant_356758/README.md`](../content/review/case_inferno_post_plant_356758/README.md)
- Issues:
  - A team that waits in CT Spawn might not see the Balcony smoke.
  - The smoke itself carries little tactical weight.
  - The draft ranks a grouped retake above a late kit defuse from a generic template. The source team retook together and lost.
- Follow-up: the smoke leaves the grouped retake strongest. Staying with the retake scores 100. A team that waited gets 80 for going in now and 50 for waiting on, because only 26 s remain. A team that saved gets 70 for going in and 25 for staying saved.
- Dispute for the reviewer: a quick grouped retake or a late kit defuse. Both look defensible, so the draft does not choose silently.

### 2. Inferno 2v2 late round: `case_inferno_late_round_no_plant_a430fd`

Two attackers in Middle have 35 s and no plant, both with AK-47s, one on 44 HP. The bomb lies dropped in Top of Mid and both defenders are unknown. The draft offers three choices: pick up and hit a site, play for information, or fake. The follow-up, a defender with an AK-47 appearing in Arch, is independent of the attackers' own movement.

- Preview: `npm run content:preview -- case_inferno_late_round_no_plant_a430fd`
- Packet: [`content/review/case_inferno_late_round_no_plant_a430fd/README.md`](../content/review/case_inferno_late_round_no_plant_a430fd/README.md)
- Issues:
  - The next kill comes 1 s after the Arch sighting, so the follow-up gives almost no time to react.
  - "The site" in "Commit to an execute now" is not named.
  - Picking up the bomb is implied rather than offered as an option.
- Follow-up: the sighting leaves the execute strongest. With 24 s left, playing slowly or faking drops to 25, so a team that played slowly gets 80 for executing now.
- Dispute for the reviewer: whether a slower 2v2 with one player on 44 HP is as defensible as committing now.

### 3. Mirage 5v4 after the opening kill: `case_mirage_opening_pick_cae8a3`

Five attackers lead 5v4 after an opening kill, with 74 s left and the bomb in Palace. One defender is visible in Middle and three are unknown, with recent defender utility in Apartments. The first call is a posture choice: default, lurk, fake or execute. The follow-up is where the case earns its place. A second defender appears in Underpass, and with two of four defenders located, the draft's strongest line flips from playing slowly (100 before, 75 after) to executing now (50 before, 100 after).

- Preview: `npm run content:preview -- case_mirage_opening_pick_cae8a3`
- Packet: [`content/review/case_mirage_opening_pick_cae8a3/README.md`](../content/review/case_mirage_opening_pick_cae8a3/README.md)
- Follow-up: a team that played slowly gets 80 for executing now and 75 for carrying on. A team that executed from the start gets 100 for continuing.
- Issues:
  - The first call is generic.
  - The follow-up depends on a teammate's own move into Underpass.
  - The pre-update best line matches what the winning team did. The rubric was not built from history, but the reviewer should check it.
- Dispute for the reviewer: does locating a second defender with 63 s left justify switching to an execute?

### 4. Mirage 2v2 retake without kits: `case_mirage_post_plant_4fb7d6`

Two unarmoured defenders without kits have 36 s left on a bomb at A, so a defuse takes 10 s. One is in CT Spawn and the other in Catwalk, with one HE grenade between them. One attacker was last seen at Top of Mid 23 s ago. The retake-or-save dilemma is genuine and the brief is clean.

- Preview: `npm run content:preview -- case_mirage_post_plant_4fb7d6`
- Packet: [`content/review/case_mirage_post_plant_4fb7d6/README.md`](../content/review/case_mirage_post_plant_4fb7d6/README.md)
- Follow-up: with 23 s left, the draft raises saving from 25 to 75 while the retake stays at 100. A team that saved gets about the same for staying saved (75) as for going in (70).
- Issues:
  - The follow-up is weak. Both attackers stayed still and were seen only because the defenders walked in, 0.2 s before the first kill.
  - "Retake together through the nearest entrance" does not fit two players 1,500 units apart.
- Decision needed first: keep, re-author or remove the follow-up. After that, the tactical questions.

### 5. Inferno 3v3 hold or rotate: `case_inferno_man_advantage_shift_927fb7`

Three defenders, two in Banana and one in Apartments, lead 11-2. A trade has just happened in Middle, where a teammate died to a Desert Eagle. Two attackers were seen 1.5 s ago, one in Middle and one in T Ramp, and the bomb carrier was last seen in T Ramp 13 s ago. The follow-up is the carrier appearing in Banana.

- Preview: `npm run content:preview -- case_inferno_man_advantage_shift_927fb7`
- Packet: [`content/review/case_inferno_man_advantage_shift_927fb7/README.md`](../content/review/case_inferno_man_advantage_shift_927fb7/README.md)
- Follow-up: the draft's priors do not weigh where a sighting is relative to the team. After the carrier appears in Banana, they still rate moving a player towards Middle as the strongest line (100) and keeping the setup as 75. That row must be set by a reviewer.
- Issues:
  - The follow-up is only visible to a team that keeps players in Banana.
  - Every attacker is placed, so the brief has no unknown fact. This is the validator warning `no_uncertain_fact`.
- Decision needed first: hold Banana or move weight to Middle, before and after the carrier appears.

## Held back

- **`case_inferno_post_plant_182a79`**: the pistol round makes "save the weapons" meaningless, and the source round has no independent follow-up. The follow-up is a clock-only placeholder, so 30 of 100 points rest on nothing real.
- **`case_mirage_late_round_no_plant_ecd6a2`**: the pistol round again, two attackers on 6 and 38 HP, and no independent follow-up. The execute template does not fit a pistol cleanup fight, so a useful case here would be a different case.
- **`case_inferno_economy_save_71be3f`**: the defenders are on match point (12-4) and a teammate has just died in B site. The 14 s plant-or-save call is real, but there is no independent follow-up and the stakes (the match) dominate the tactics.
- **`case_inferno_man_advantage_shift_6c2440`**: a 2v2 at match point where the follow-up exists only because the source team pushed into Middle. The draft's best line is a heuristic split of two players.
- **`case_mirage_man_advantage_shift_e451c6`**: only one action scores as defensible (the validator warning `single_defensible_action`). The 0.1 s follow-up gives no time to react.

## Follow-up scoring and stress test

The follow-up is worth 30 of the 100 points. It used to be scored per answer, whatever the main call had been. In every draft, "Change your line to use the new information" earned 28/30 and "Stick to the line you chose" 18/30. So in `356758`, a player who kept the best line scored 88 and one who answered "change" scored 98.

The rubric now keys every follow-up cell by main action (`schemaVersion: 2`, see [`content/README.md`](../content/README.md#follow-up-scoring)). The validator rejects a matrix with a missing cell, and one in which every answer scores the same after every action. It warns when an answer scores high and alike after main actions of clearly different quality.

The draft generator asks "what is your line now?", with one answer per published action. Each cell is the value of that line under the post-update state, re-ranked by the same priors as the main call, minus a switching cost: 10 within the same posture, 20 one step apart, and 30 between passive and active. These values are proposals for the reviewer to confirm or rewrite row by row.

`npm run content:score -- <case-id>` prints every locked line against every answer, and the named stress lines. The totals below are with the best qualifier and evidence pair for each line. They are identical when played through the real Worker.

| Case | Good call kept | Good call needlessly reversed | Weak call, best correction | Weak call kept | Plausible alternative kept |
|---|---|---|---|---|---|
| `356758` | 100 | 79 | 54 (save → retake) | 40 | 73 (wait) |
| `a430fd` | 100 | 72 | 72 (fake → execute) | 53 | 65 (slow) |
| `cae8a3` | 93 (slow) | 87 | 75 (execute kept: after the update it is the strongest line) | 75 | 80 (lurk) |
| `4fb7d6` | 100 | 79 | 55 (save kept: after the update it is defensible) | 55 | 73 (wait) |
| `927fb7` | 100 | 87 | 66 (fall back → Middle) | 60 | 80 (information) |

Before and after in `356758`, the Inferno retake:

| Locked line → answer | Before | After |
|---|---|---|
| Retake → keep retaking ("stick") | 88 | 100 |
| Retake → "change your line" / wait instead | 98 | 79 |
| Wait → keep waiting | 76 | 73 |
| Wait → go in now ("change") | 85 | 82 |
| Save → go in now ("change") | 60 | 54 |
| Save → keep saving | 42 | 40 |

Other rubric findings, unchanged by this fix:

| Finding | Effect | Proposed fix |
|---|---|---|
| Main-call ratings come from situation templates, not from the round. | Retake cases with and without kits share the same main-call ratings. | Reviewer sets the main-call ratings. The draft ratings are a starting point. |
| Evidence pairs barely separate. | For the reasonable actions, the best and worst evidence pairs differ by 6–7 of 20 points, and any pair with the clock scores near the top. | Reviewer checks the evidence matrix for the two or three signals that should matter. |
| The priors do not weigh where a sighting is relative to the team. | In `927fb7`, the follow-up still favours moving towards Middle after the carrier appears in Banana. | Reviewer sets that row by hand. |

The historical line is never used as the answer key.

## Local preview check

The five cases were played end to end in the local preview (Worker plus local D1), with a new anonymous identity per line: the five stress lines of each case, 25 in total. Every total matched `content:score`. No API response carried follow-up content before the main call was locked, reveal content before the follow-up was locked, or rubric data at any point.

Still open from the preview:

- The debrief explains the proposed best line even when the player chose another one. For example, a player who saved still reads "Why it works" for the grouped retake.
- The follow-up review now explains the scoring rule and names the strongest line after the update, but it is the same text for every player.
