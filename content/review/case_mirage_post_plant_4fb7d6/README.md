# Review packet: 2v2 retake at A on Mirage

`case_mirage_post_plant_4fb7d6` · status **draft** · queue: **NEEDS TACTICAL DECISION** · about 5–10 minutes

A synthetic case built from a decision point in a recorded round. The options, scores and debrief are proposals from the draft generator; nothing here has had human tactical review. You do not need the demo or the case JSON.

To play it locally: `npm run content:preview -- case_mirage_post_plant_4fb7d6`, then `npm run dev`, and open Today.

**In one paragraph.** Two defenders without armour or kits (a 10-second defuse) face a bomb planted at A 4 seconds earlier, 36 seconds before detonation. They are split: one in CT Spawn, one in Catwalk, about 1,500 units apart, with one HE grenade between them. One attacker with a Desert Eagle was last seen at Top of Mid 23 seconds ago; the other is unknown. The retake-or-save dilemma is genuine, but the follow-up is weak: both attackers stayed where they were and were only seen because the defenders moved in, less than a second before the first kill.

## 1. Situation

| | |
| --- | --- |
| Map | Mirage |
| Side | CT (defenders) |
| Score and match context | Score: your team 0, the attackers 1. |
| Time | 36 s left on the bomb timer (once planted, the round clock no longer applies). |
| Alive | 2 CTs alive against 2 Ts. |
| Weapons and armour | Your players: SSG 08 + USP-S, 100 HP, no armour; AK-47 + USP-S, 96 HP, no armour. |
| Utility and defuse kits | No one on your team carries a defuse kit. Your team has 1 HE grenade left. |
| Bomb | The bomb is planted at A; 36 s remain on the bomb timer. |
| Your positions | Your team is positioned: 1 in CT Spawn, 1 in Catwalk. |

## 2. What the deciding team knew

| Player-known view (all the brief may use) | Ground truth (reviewer only, never shown to players) |
| --- | --- |
| ![player-known](player-known.svg) | ![ground truth](ground-truth.svg) |

**Confirmed**
- The attackers detonated a smoke in A site 13 s ago.
- The attackers detonated a smoke in Sniper's Nest 14 s ago.

**Last seen (with age)**
- One attacker was last seen in Top of Mid 23 s ago with a Desert Eagle.

**Inferred**
- The bomb was planted 4 s ago, so at least one attacker was at site A moments ago. Basis: plant announcement.

**Unknown**
- The position of one attacker is unknown.

<details><summary>Last 20 s of the source round before the decision (reviewer context, includes events the team could not see)</summary>

- `-18.3 s` A T player detonated a flash in Top of Mid
- `-17.7 s` A CT player killed a T player with a USP-S in B site
- `-17.2 s` A T player killed a CT player with an AK-47 (headshot) in CT Spawn
- `-13.5 s` A T player detonated a smoke in Sniper's Nest
- `-12.9 s` A T player detonated a smoke in A site
- `-12.1 s` A T player killed a CT player with an AK-47 in A site
- `-7.0 s` A player began planting at A
- `-3.9 s` A player planted the bomb at A

</details>

## 3. Main decision

The player picks one action, one way to execute it and a confidence level (confidence is never scored).

| Action | Ways to execute it (proposed main-call quality, 0–100) | Proposed tier: the rule behind it |
| --- | --- | --- |
| Retake together through the nearest entrance | Clear the site together and trade the first contact (100); Move as one stack and keep utility for the defuse (90); Send one player ahead to probe while the other follows (75) | best: numbers level or better, or -1 with a comfortable clock: group retake is the proposed lead |
| Wait for information before committing | Listen for footsteps before moving (75); Hold back and go for a late defuse (65) | good: at least one enemy is unlocated and the clock is long: information has real value |
| Save the weapons | Everyone saves and avoids contact (25); Save, but take a trade if an attacker is met (15) | poor: numbers level or better and a comfortable clock: saving gives away a winnable round |

**How the main call and evidence score**

- Main call, up to 50 points: half the line's quality above. Each line is rated on commitment timing (60%) and information use (40%).
- Evidence, up to 20 points: the player picks two of "Bomb timer", "Alive count", "Attacker last seen in Top of Mid", "Own utility", "Defuse kit availability". Each pair has proposed points for each action:

| Action | Highest-scoring pairs | Lowest-scoring pair |
| --- | --- | --- |
| Retake together through the nearest entrance | Bomb timer + Attacker last seen in Top of Mid (20); Alive count + Bomb timer (18) | Defuse kit availability + Own utility (14) |
| Wait for information before committing | Alive count + Bomb timer (20); Bomb timer + Attacker last seen in Top of Mid (20) | Defuse kit availability + Own utility (13) |
| Save the weapons | Alive count + Bomb timer (20); Alive count + Defuse kit availability (16) | Attacker last seen in Top of Mid + Own utility (6) |

**Why more than one line may be defensible**

- Retake together through the nearest entrance (best line 100): numbers level or better, or -1 with a comfortable clock: group retake is the proposed lead.
- Wait for information before committing (best line 75): at least one enemy is unlocated and the clock is long: information has real value.
- The draft's debrief names the strongest alternative: The closest alternative was to wait for information first, accepting less time on the bomb for a better read on positions.

## 4. Follow-up

**A new sighting**: About 13 seconds later, two attackers appear: one in A site, one in Jungle.

- new: One attacker is visible in A site right now with an AK-47.
- new: One attacker is visible in Jungle right now with a Desert Eagle.
- changed: About 23 seconds now remain on the bomb timer.

**Timing**

- The new information arrives 13.0 s after the decision.
- Reaction window: the next kill in the source round comes 0.17 s after the new information — almost no time to act on it.
- It depends on the source team's own movement: a team on another line might not have seen it.

**Follow-up score matrix** (proposed quality 0–100; worth up to 30 points): rows are the action the player locked, columns the answer they give now.

| Locked action | Hold off and keep gathering information | Save the weapons from here | Go into the retake together now |
| --- | --- | --- | --- |
| Wait for information before committing | 50 | 55 | 80 |
| Save the weapons | 30 | 75 | 70 |
| Retake together through the nearest entrance | 30 | 45 | 100 |

How the draft built it: each cell is the value of the answer's line after the update, minus a switching cost (10 within the same posture, 20 one step apart, 30 between passive and active; nothing for staying). Under the draft's rules the update leaves the strongest line unchanged: before, Retake together through the nearest entrance; after, Retake together through the nearest entrance.

Totals for named lines (best way to execute and best evidence pair for each action):

```
  good main -> stays with it               100  (follow-up 30/30: Retake together through the nearest entrance -> Go into the retake together now)
  good main -> unnecessary reversal         79  (follow-up  9/30: Retake together through the nearest entrance -> Hold off and keep gathering information)
  weak main -> best correction              55  (follow-up 22/30: Save the weapons -> Save the weapons from here)
  weak main -> stubborn continuation        55  (follow-up 22/30: Save the weapons -> Save the weapons from here)
  plausible alternative -> stays with it    73  (follow-up 15/30: Wait for information before committing -> Hold off and keep gathering information)
```

## 5. What actually happened

> Descriptive only. This is what one team did in one recorded round. It is not the answer key, and the scoring above was not built from it.

In the source round, over the next 10 s: 1 player moved from CT Spawn to A site; 1 player moved from Catwalk to Connector. Over the next 20 s the team used no utility and got 2 kills and lost no players. Bomb: a player began defusing at A. The CTs won when the bomb was defused; 2 of your team survived.

- `+13 s` In the source round, a CT player killed a T player with a USP-S in A site.
- `+14 s` A CT player killed a T player with an AK-47 in Jungle.
- `+15 s` A CT player began defusing at A.
- `+25 s` A CT player defused the bomb at A.

Takeaway the draft proposes ("What to remember"): *On a retake, weigh the seconds a defuse needs against what you actually know: commit while the clock and the numbers support it, and save when they do not.*

## 6. Questions for the reviewer

1. No kit, no armour, one HE and 36 s left at 2v2: is a retake defensible, or is saving the AK-47 and SSG 08 equally sound?
2. Can two players starting in CT Spawn and Catwalk trade each other at all, or does "retake together" first require regrouping?
3. Which route should each player take to A in practice?
4. Is a 23-second-old Desert Eagle sighting at Top of Mid meaningful evidence for this decision?
5. Should this case keep its current follow-up (both attackers seen as the defenders arrive), or should the follow-up be removed or re-authored?
6. Is one HE grenade relevant to a 10-second no-kit defuse, and what should "keep utility for the defuse" mean here?
7. With both attackers seen, 23 s left and a 10 s defuse, is saving now as reasonable as the draft proposes (75), and is going in still the best line?

Assumptions the draft makes that you may want to challenge:

- The follow-up sighting exists only because the source team moved; the attackers did not move during those 13 seconds.
- The draft's grouped-retake qualifiers assume the two defenders can move together, but they start far apart and used two routes in the source round.
- Without kits, the draft still ranks a late defuse as a waiting line; whether that is realistic is a tactical question.
- Follow-up matrix: with 23 s left and no kit, the draft raises saving from 25 to 75 while the retake stays at 100, so a team that saved is credited about the same for staying saved (75) as for going in now (70).

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

Only a named human CS2 reviewer can approve. `approved` lets the owner move `case_mirage_post_plant_4fb7d6` to `tactically_reviewed`; `changes_requested` keeps it a draft.
