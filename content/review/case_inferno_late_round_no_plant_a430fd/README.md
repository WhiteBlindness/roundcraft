# Review packet: 2v2 with 35 s left and the bomb on the ground on Inferno

`case_inferno_late_round_no_plant_a430fd` · status **draft** · queue: **REVIEW FIRST** · about 5–10 minutes

A synthetic case built from a decision point in a recorded round. The options, scores and debrief are proposals from the draft generator; nothing here has had human tactical review. You do not need the demo or the case JSON.

To play it locally: `npm run content:preview -- case_inferno_late_round_no_plant_a430fd`, then `npm run dev`, and open Today.

**In one paragraph.** Two attackers in Middle, both with AK-47s but one on 44 HP, have 35 seconds left and no plant. The bomb lies dropped in Top of Mid, about 700 units away, and both defenders are unknown. The dilemma is real: pick up the bomb and hit a site at once, take information first, or fake. The follow-up (a defender with an AK-47 appears in Arch about 11 seconds later) arrives close to the next fight, so its value as a second decision needs a human check.

## 1. Situation

| | |
| --- | --- |
| Map | Inferno |
| Side | T (attackers) |
| Score and match context | Score: your team 2, the defenders 0. |
| Time | The bomb has not been planted; about 35 s remain on the round clock. |
| Alive | 2 Ts alive against 2 CTs. |
| Weapons and armour | Your players: AK-47 + Glock-18, 94 HP, full armour; AK-47 + P2000, 44 HP, full armour. |
| Utility and defuse kits | Your team has 1 molotov left. |
| Bomb | The bomb is on the ground in Top of Mid. |
| Your positions | Your team is positioned: 2 in Middle. |

## 2. What the deciding team knew

| Player-known view (all the brief may use) | Ground truth (reviewer only, never shown to players) |
| --- | --- |
| ![player-known](player-known.svg) | ![ground truth](ground-truth.svg) |

**Confirmed**
- Nothing beyond the situation table above.

**Last seen (with age)**
- None.

**Inferred**
- None.

**Unknown**
- The positions of two defenders are unknown.

<details><summary>Last 20 s of the source round before the decision (reviewer context, includes events the team could not see)</summary>

- `-18.7 s` A T player killed a CT player with an AK-47 (headshot) in Ruins
- `-10.2 s` A T player detonated a flash in Banana
- `-1.0 s` A T player detonated a molotov in Top of Mid

</details>

## 3. Main decision

The player picks one action, one way to execute it and a confidence level (confidence is never scored).

| Action | Ways to execute it (proposed main-call quality, 0–100) | Proposed tier: the rule behind it |
| --- | --- | --- |
| Commit to an execute now | Hit the site together and trade each entry (100); Plant quickly and set up crossfires (90) | best: under 45 s: a committed execute is defensible; promoted from 'good' so at least one line reaches Best-supported |
| Keep the default and take information first | Play slowly and listen for rotations (75); Probe with one player while the other holds (65) | good: moderate clock and little known |
| Fake one site, then rotate to the other | Sell the fake with utility (50); Fake quietly and rotate early (40) | fair: enough clock to try, but the fake has to work |

**How the main call and evidence score**

- Main call, up to 50 points: half the line's quality above. Each line is rated on commitment timing (60%) and utility use (40%).
- Evidence, up to 20 points: the player picks two of "Round clock", "Alive count", "Own utility", "Unknown defender positions", "Own team positions". Each pair has proposed points for each action:

| Action | Highest-scoring pairs | Lowest-scoring pair |
| --- | --- | --- |
| Commit to an execute now | Own utility + Round clock (20); Alive count + Own utility (18) | Unknown defender positions + Own team positions (10) |
| Keep the default and take information first | Unknown defender positions + Round clock (20); Alive count + Unknown defender positions (18) | Own team positions + Own utility (12) |
| Fake one site, then rotate to the other | Alive count + Round clock (20); Own utility + Round clock (20) | Unknown defender positions + Own team positions (11) |

**Why more than one line may be defensible**

- Commit to an execute now (best line 100): under 45 s: a committed execute is defensible; promoted from 'good' so at least one line reaches Best-supported.
- Keep the default and take information first (best line 75): moderate clock and little known.
- The draft's debrief names the strongest alternative: The closest alternative was to gather information before acting, spending clock to reduce the guess.

## 4. Follow-up

**A new sighting**: About 11 seconds later, a defender appears in Arch.

- new: One defender is visible in Arch right now with an AK-47.
- new: The position of one defender is unknown.
- changed: About 24 seconds now remain on the round clock.

**Timing**

- The new information arrives 11.0 s after the decision.
- Reaction window: the next kill in the source round comes 0.98 s after the new information — almost no time to act on it.
- It comes from the opponents, not from the source team's own movement.

**Follow-up score matrix** (proposed quality 0–100; worth up to 30 points): rows are the action the player locked, columns the answer they give now.

| Locked action | Keep playing slowly for information | Fake here and rotate away | Execute on the site now |
| --- | --- | --- | --- |
| Fake one site, then rotate to the other | 5 | 25 | 90 |
| Commit to an execute now | 5 | 15 | 100 |
| Keep the default and take information first | 25 | 5 | 80 |

How the draft built it: each cell is the value of the answer's line after the update, minus a switching cost (10 within the same posture, 20 one step apart, 30 between passive and active; nothing for staying). Under the draft's rules the update leaves the strongest line unchanged: before, Commit to an execute now; after, Commit to an execute now.

Totals for named lines (best way to execute and best evidence pair for each action):

```
  good main -> stays with it               100  (follow-up 30/30: Commit to an execute now -> Execute on the site now)
  good main -> unnecessary reversal         72  (follow-up  2/30: Commit to an execute now -> Keep playing slowly for information)
  weak main -> best correction              72  (follow-up 27/30: Fake one site, then rotate to the other -> Execute on the site now)
  weak main -> stubborn continuation        53  (follow-up  8/30: Fake one site, then rotate to the other -> Fake here and rotate away)
  plausible alternative -> stays with it    65  (follow-up  7/30: Keep the default and take information first -> Keep playing slowly for information)
```

## 5. What actually happened

> Descriptive only. This is what one team did in one recorded round. It is not the answer key, and the scoring above was not built from it.

In the source round, over the next 10 s: 2 players held position in Middle. Over the next 20 s the team used 1 molotov and got 1 kill and lost 1 player. The Ts won by eliminating the defenders; one of your team survived.

- `+3 s` In the source round, a T player threw a molotov that detonated in Apartments.
- `+4 s` A CT player threw a flash that detonated in Top of Mid.
- `+5 s` A CT player threw a flash that detonated in Middle.
- `+12 s` A T player killed a CT player with an AK-47 in Arch.
- `+13 s` A CT player killed a T player with an M4A1-S (headshot) in Middle.
- `+17 s` A T player picked up the bomb in Top of Mid.
- `+23 s` A T player began planting at A.
- `+26 s` A T player planted the bomb at A.
- `+31 s` A T player killed a CT player with an AK-47 (headshot) in A site.
- `+31 s` The round ended: the Ts won by eliminating the defenders.

Takeaway the draft proposes ("What to remember"): *Decide when to stop gathering information: keep reading while the clock is long and positions are unknown, and commit once the clock or the numbers force the plan.*

## 6. Questions for the reviewer

1. With the bomb about 700 units away and 35 s left, is committing now clearly best, or can a 2v2 with one player on 44 HP be played slower?
2. Which site does "the site" mean here, and can B be reached in time from Middle after picking up the bomb?
3. Is a fake with two players and one molotov ever playable at 35 s, or should it score as clearly wrong?
4. Should picking up the bomb be an explicit option, or is it implied by every attacking line?
5. Does the Arch sighting work as a follow-up for every line, or only for the route the source team took?
6. Is the 44 HP player relevant enough to change the ranking?
7. With 24 s left and one defender now seen in Arch, is executing the only sound line for every team, including one that faked, or can a slow team still play for a late pick?

Assumptions the draft makes that you may want to challenge:

- The draft treats "hit the site together" as the best line and a plant-then-crossfire as close behind; both rankings come from templates.
- The Arch sighting depends partly on where the source team walked; a team on another route might not see it at the same time.
- Retrieving the dropped bomb is folded into the action rather than offered as its own choice.
- Follow-up matrix: the Arch sighting leaves the execute strongest. With 24 s left, playing slowly or faking collapses to 25, so a team that played slowly is credited 80 for executing now.

## 7. Approval form

Copy this section into your reply, or fill it in here. One line per answer is enough.

- **Are the main options realistic for this moment?** ☐ Yes ☐ No
  Changes: ______________________

- **Best-supported line:** ______________________ (agree with the draft's ☐ / different ☐)

- **Other defensible lines:** ______________________

- **Is the evidence weighting fair?** ☐ Yes ☐ No
  Changes: ______________________

- **Is the follow-up realistic (it could plausibly reach a team on any line)?** ☐ Yes ☐ No
  Changes: ______________________

- **Is the follow-up score matrix fair?** ☐ Yes ☐ No
  Rows or cells to change: ______________________

- **Are callouts, timings and numbers correct?** ☐ Yes ☐ No
  Corrections: ______________________

- **Is the takeaway ("What to remember") correct and transferable?** ☐ Yes ☐ No
  Rewrite: ______________________

- **Verdict:** ☐ Approve ☐ Changes requested
- **Reviewer name and date:** ______________________

The case owner records the verdict in the case file, so the reviewer does not need to touch JSON:

```json
"reviewers": [{ "name": "<reviewer>", "reviewedAt": "YYYY-MM-DD", "verdict": "approved | changes_requested", "notes": "<answers above>" }]
```

Only a named human CS2 reviewer can approve. `approved` lets the owner move `case_inferno_late_round_no_plant_a430fd` to `tactically_reviewed`; `changes_requested` keeps it a draft.
