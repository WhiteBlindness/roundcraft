# Content review queue

The ten mined drafts under `content/cases/` all pass the validator, but that only proves structure. This queue ranks them by how much a human tactical review is likely to be worth. It lists the five worth reviewing and the five to hold back.

Every case here is `draft`. The options, rubric and debrief are proposals from the draft generator, and no case has had human tactical review. Only a named human CS2 reviewer can move a case to `tactically_reviewed`, as the pipeline in [`content/README.md`](../content/README.md) describes.

## How to review one case (5–10 minutes)

1. Open the packet, `content/review/<case-id>/README.md`. It holds:
   - the player-known and ground-truth diagrams;
   - the brief exactly as a player sees it;
   - the last 20 s of the source round;
   - every proposed line with its score under the production 50/20/30 model;
   - the follow-up and its caveats;
   - what happened next;
   - the assumptions and the questions only a reviewer can answer.
2. Optionally play it: run `npm run content:preview -- <case-id>`, then `npm run dev`, and open Today. Each preview makes that case today's case locally. It never touches production.
3. Answer the questions in the packet. Record the verdict in the case file's `editorial.reviewers` as `approved` or `changes_requested`, with notes. The packet includes the exact snippet.

Packets are regenerated with `roundcraft-miner case packet` from `content/review/questions.json`, which holds the summary, assumptions and questions for each case.

## Ranked queue

| Rank | Case | Situation | Action |
|---|---|---|---|
| 1 | `case_inferno_post_plant_356758` | CT 2v2 retake at A, 36 s, two kits, no utility | **REVIEW FIRST** |
| 2 | `case_inferno_late_round_no_plant_a430fd` | T 2v2, 35 s, bomb dropped at Top of Mid | **REVIEW FIRST** |
| 3 | `case_inferno_man_advantage_shift_927fb7` | CT 3v3 hold or rotate, 92 s, after a trade in Middle | **REVIEW FIRST** |
| 4 | `case_mirage_post_plant_4fb7d6` | CT 2v2 retake at A, 36 s, no kits, split team | **NEEDS TACTICAL DECISION** |
| 5 | `case_mirage_opening_pick_cae8a3` | T 5v4 after the opening kill, 74 s | **KEEP** (second wave) |
| – | `case_inferno_post_plant_182a79` | CT 3v4 retake on the pistol round | DROP |
| – | `case_mirage_late_round_no_plant_ecd6a2` | T 3v2 on the pistol round, two players on low HP | DROP |
| – | `case_inferno_economy_save_71be3f` | T 2v3 plant or save, 14 s, match point | DROP |
| – | `case_inferno_man_advantage_shift_6c2440` | CT 2v2 at match point, 84 s | DROP |
| – | `case_mirage_man_advantage_shift_e451c6` | T 2v3 after a trade, 78 s | DROP |

DROP means "do not spend expert time on it now". The files stay in the repository, and the owner decides whether to delete them.

## Review first

### 1. Inferno 2v2 retake at A: `case_inferno_post_plant_356758`

Two defenders in CT Spawn have 36 s left on a bomb planted at A. Both have kits and full armour, one holds an AWP, and the team has no utility. One attacker with an AK-47 was last seen in A site 14 s ago, and the planter's position is unknown. The brief is fully player-known. The follow-up, an enemy smoke in Balcony, is an attacker action rather than something the defenders stumble into.

- Preview: `npm run content:preview -- case_inferno_post_plant_356758`
- Packet: [`content/review/case_inferno_post_plant_356758/README.md`](../content/review/case_inferno_post_plant_356758/README.md)
- Issues:
  - A team that waits in CT Spawn might not see the Balcony smoke.
  - The smoke itself carries little tactical weight.
  - The draft ranks a grouped retake above a late kit defuse from a generic template. The source team retook together and lost.
- Dispute for the reviewer: a quick grouped retake or a late kit defuse. Both look defensible, so the draft does not choose silently.

### 2. Inferno 2v2 late round: `case_inferno_late_round_no_plant_a430fd`

Two attackers in Middle have 35 s and no plant, both with AK-47s, one on 44 HP. The bomb lies dropped in Top of Mid and both defenders are unknown. The draft offers three choices: pick up and hit a site, play for information, or fake. The follow-up, a defender with an AK-47 appearing in Arch, is independent of the attackers' own movement.

- Preview: `npm run content:preview -- case_inferno_late_round_no_plant_a430fd`
- Packet: [`content/review/case_inferno_late_round_no_plant_a430fd/README.md`](../content/review/case_inferno_late_round_no_plant_a430fd/README.md)
- Issues:
  - The next kill comes 1 s after the Arch sighting, so the follow-up gives almost no time to react.
  - "The site" in "Commit to an execute now" is not named.
  - Picking up the bomb is implied rather than offered as an option.
- Dispute for the reviewer: whether a slower 2v2 with one player on 44 HP is as defensible as committing now.

### 3. Inferno 3v3 hold or rotate: `case_inferno_man_advantage_shift_927fb7`

Three defenders, two in Banana and one in Apartments, lead 11-2. A trade has just happened in Middle, where a teammate died to a Desert Eagle. Two attackers were seen 1.5 s ago, one in Middle and one in T Ramp, and the bomb carrier was last seen in T Ramp 13 s ago. The follow-up is the carrier appearing in Banana.

- Preview: `npm run content:preview -- case_inferno_man_advantage_shift_927fb7`
- Packet: [`content/review/case_inferno_man_advantage_shift_927fb7/README.md`](../content/review/case_inferno_man_advantage_shift_927fb7/README.md)
- Issues:
  - The draft's best line rotates a player towards Middle, away from Banana, where the carrier then appears.
  - The follow-up is only visible to a team that keeps players in Banana.
  - Every attacker is placed, so the brief has no unknown fact. This is the validator warning `no_uncertain_fact`.
- Dispute for the reviewer: hold Banana or move weight to Middle after the trade.

### 4. Mirage 2v2 retake without kits: `case_mirage_post_plant_4fb7d6`

Two unarmoured defenders without kits have 36 s left on a bomb at A, so a defuse takes 10 s. One is in CT Spawn and the other in Catwalk, with one HE grenade between them. One attacker was last seen at Top of Mid 23 s ago. The retake-or-save dilemma is genuine and the brief is clean.

- Preview: `npm run content:preview -- case_mirage_post_plant_4fb7d6`
- Packet: [`content/review/case_mirage_post_plant_4fb7d6/README.md`](../content/review/case_mirage_post_plant_4fb7d6/README.md)
- Issues:
  - The follow-up is weak. Both attackers stayed still and were seen only because the defenders walked in, 0.2 s before the first kill.
  - "Retake together through the nearest entrance" does not fit two players 1,500 units apart.
- Decision needed first: keep, re-author or remove the follow-up. After that, the tactical questions.

### 5. Mirage 5v4 after the opening kill: `case_mirage_opening_pick_cae8a3`

Five attackers lead 5v4 after an opening kill, with 74 s left and the bomb in Palace. One defender is visible in Middle and three are unknown, with recent defender utility in Apartments. The brief is clean, but the question is a generic mid-round posture choice rather than a specific read.

- Preview: `npm run content:preview -- case_mirage_opening_pick_cae8a3`
- Packet: [`content/review/case_mirage_opening_pick_cae8a3/README.md`](../content/review/case_mirage_opening_pick_cae8a3/README.md)
- Issues:
  - The follow-up depends on a teammate's own move into Underpass.
  - The best line matches what the winning team did. The rubric was not built from history, but the reviewer should check it.

## Held back

- **`case_inferno_post_plant_182a79`**: the pistol round makes "save the weapons" meaningless, and the source round has no independent follow-up. The follow-up is a clock-only placeholder, so 30 of 100 points rest on nothing real.
- **`case_mirage_late_round_no_plant_ecd6a2`**: the pistol round again, two attackers on 6 and 38 HP, and no independent follow-up. The execute template does not fit a pistol cleanup fight, so a useful case here would be a different case.
- **`case_inferno_economy_save_71be3f`**: the defenders are on match point (12-4) and a teammate has just died in B site. The 14 s plant-or-save call is real, but there is no independent follow-up and the stakes (the match) dominate the tactics.
- **`case_inferno_man_advantage_shift_6c2440`**: a 2v2 at match point where the follow-up exists only because the source team pushed into Middle. The draft's best line is a heuristic split of two players.
- **`case_mirage_man_advantage_shift_e451c6`**: only one action scores as defensible (the validator warning `single_defensible_action`). The 0.1 s follow-up gives no time to react.

## Rubric stress test

`npm run content:score -- <case-id>` scores every action × qualifier × evidence pair × follow-up answer with the production scoring code. Findings across all ten drafts:

| Finding | Effect | Proposed fix |
|---|---|---|
| Follow-up quality is set per response, independent of the main call. This is a limit of the rubric format. | For the seven drafts whose follow-up is new information, "Change your line to use the new information" always earns 28/30 and "Stick to the line you chose" 18/30. Always answering "change" adds about 10 points. A player who saved and then chooses "Stop and save the weapons" gets 9/30 for a consistent line. | Owner decision. Either extend the rubric so follow-up quality can depend on the main action (a contract change), or have the reviewer set follow-up qualities for each case. |
| Rubrics come from situation templates, not from the round. | `356758` and `4fb7d6` have identical score distributions (min 23, median 70, max 98) despite kits vs no kits and no utility vs one HE. | Reviewer sets the main-call ratings. The draft ratings are a starting point. |
| Evidence pairs barely separate. | For the reasonable actions, the best and worst evidence pairs differ by 6–7 of 20 points, and any pair with the clock scores near the top. | Reviewer checks the evidence matrix for the two or three signals that should matter. |
| No combination reaches 100. | The maximum is 93–98. | Expected with a non-maximal evidence pair. Not a defect. |

The historical line is never used as the answer key. Where the best line matches history (`cae8a3`), it is a coincidence of the template, to be confirmed by the reviewer.

## Local preview check

The shortlist was played end to end in the local preview (Worker plus local D1), with a new anonymous identity per line, 11 lines in total:

| Case | Lines played |
|---|---|
| `356758` | retake 88, late kit defuse 83, save 34 |
| `a430fd` | execute 96, slow 76 |
| `4fb7d6` | retake 84, save 38 |
| `927fb7` | rotate 98, hold 67 |
| `cae8a3` | slow 96, execute 61 |

For every line, no API response carried follow-up content before the main call was locked, reveal content before the follow-up was locked, or rubric data at any point. Brief, evidence, call, follow-up, reveal, "Your line" against "What actually happened" and "What to remember" all rendered.

What the preview showed, beyond the rubric findings above:

- The debrief explains the proposed best line even when the player chose another one. For example, a player who saved still reads "Why it works" for the grouped retake.
- The follow-up review text is generic and does not change with the case.
