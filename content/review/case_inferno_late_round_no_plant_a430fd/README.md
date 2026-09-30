# Review packet: 2v2 with 35 s left and the bomb on the ground on Inferno

`case_inferno_late_round_no_plant_a430fd` · de_inferno · T side · status **draft** · recommendation **REVIEW FIRST**

Demo-grounded synthetic draft. Options, debrief and rubric are proposals generated from the source round; nothing here has had human tactical review. Time budget: 5–10 minutes.

Play it locally: `npm run content:preview -- case_inferno_late_round_no_plant_a430fd` then `npm run dev` and open Today.

## Why this case

Two attackers in Middle, both with AK-47s but one on 44 HP, have 35 seconds left and no plant. The bomb lies dropped in Top of Mid, about 700 units away, and both defenders are unknown. The dilemma is real: pick up the bomb and hit a site at once, take information first, or fake. The follow-up (a defender with an AK-47 appears in Arch about 11 seconds later) arrives close to the next fight, so its value as a second decision needs a human check.

## Tactical snapshot

| Player-known view (what the brief may use) | Ground truth (reviewer only, never shown to players) |
| --- | --- |
| ![player-known](player-known.svg) | ![ground truth](ground-truth.svg) |

## Brief as the player sees it

- **confirmed** — You play the T side on Inferno.
- **confirmed** — The bomb has not been planted; about 35 s remain on the round clock.
- **confirmed** — The bomb is on the ground in Top of Mid.
- **confirmed** — 2 Ts alive against 2 CTs.
- **confirmed** — Your players: AK-47 + Glock-18, 94 HP, full armour; AK-47 + P2000, 44 HP, full armour.
- **confirmed** — Your team has 1 molotov left.
- **confirmed** — Score: your team 2, the defenders 0.
- **confirmed** — Your team is positioned: 2 in Middle.
- **unknown** — The positions of two defenders are unknown.

Evidence options (pick two): Round clock · Alive count · Own utility · Unknown defender positions · Own team positions

## Recent timeline before the decision (source round)

- `-18.7 s` A T player killed a CT player with an AK-47 (headshot) in Ruins
- `-10.2 s` A T player detonated a flash in Banana
- `-1.0 s` A T player detonated a molotov in Top of Mid

## Proposed lines and scoring (proposal, not truth)

| Action | Qualifier | Main-call quality (0–100) |
| --- | --- | --- |
| Commit to an execute now | Hit the site together and trade each entry | 100 |
| Commit to an execute now | Plant quickly and set up crossfires | 90 |
| Keep the default and take information first | Play slowly and listen for rotations | 75 |
| Keep the default and take information first | Probe with one player while the other holds | 65 |
| Fake one site, then rotate to the other | Sell the fake with utility | 50 |
| Fake one site, then rotate to the other | Fake quietly and rotate early | 40 |

Every combination scored with the production 50/20/30 model:

```
case_inferno_late_round_no_plant_a430fd: 180 combinations; min 33, p25 52, median 63, p75 71, max 100; 100s: 1

Main call (best total per line):
  100  Commit to an execute now / Hit the site together and trade each entry
   95  Commit to an execute now / Plant quickly and set up crossfires
   82  Keep the default and take information first / Play slowly and listen for rotations
   77  Keep the default and take information first / Probe with one player while the other holds
   72  Fake one site, then rotate to the other / Sell the fake with utility
   67  Fake one site, then rotate to the other / Fake quietly and rotate early

Follow-up against the locked line (best qualifier and evidence pair for that line):
  locked: Fake one site, then rotate to the other / Sell the fake with utility  (main 25/50, evidence 20/20)
    Execute on the site now              follow-up 27/30  total  72
    Fake here and rotate away            follow-up  8/30  total  53
    Keep playing slowly for information  follow-up  2/30  total  47
  locked: Commit to an execute now / Hit the site together and trade each entry  (main 50/50, evidence 20/20)
    Execute on the site now              follow-up 30/30  total 100
    Fake here and rotate away            follow-up  5/30  total  75
    Keep playing slowly for information  follow-up  2/30  total  72
  locked: Keep the default and take information first / Play slowly and listen for rotations  (main 38/50, evidence 20/20)
    Execute on the site now              follow-up 24/30  total  82
    Keep playing slowly for information  follow-up  7/30  total  65
    Fake here and rotate away            follow-up  1/30  total  59

Stress lines:
  good main -> stays with it               100  (follow-up 30/30: Commit to an execute now -> Execute on the site now)
  good main -> unnecessary reversal         72  (follow-up  2/30: Commit to an execute now -> Keep playing slowly for information)
  weak main -> best correction              72  (follow-up 27/30: Fake one site, then rotate to the other -> Execute on the site now)
  weak main -> stubborn continuation        53  (follow-up  8/30: Fake one site, then rotate to the other -> Fake here and rotate away)
  plausible alternative -> stays with it    65  (follow-up  7/30: Keep the default and take information first -> Keep playing slowly for information)

Follow-up checks:
  no findings
```

## Follow-up

A new sighting: About 11 seconds later, a defender appears in Arch.

- **new** — One defender is visible in Arch right now with an AK-47.
- **new** — The position of one defender is unknown.
- **changed** — About 24 seconds now remain on the round clock.

Proposed follow-up quality (0–100, worth up to 30 points) by the line the player locked (rows) and the answer they give now (columns):

| Locked line | Keep playing slowly for information | Fake here and rotate away | Execute on the site now |
| --- | --- | --- | --- |
| Fake one site, then rotate to the other | 5 | 25 | 90 |
| Commit to an execute now | 5 | 15 | 100 |
| Keep the default and take information first | 25 | 5 | 80 |

The update leaves the strongest line unchanged: before, Commit to an execute now; after, Commit to an execute now.

Follow-up caveats:

- The next kill follows 1.0 s after the new information.

## What happened in the source round (reveal, not the answer key)

In the source round, over the next 10 s: 2 players held position in Middle. Over the next 20 s the team used 1 molotov and got 1 kill and lost 1 player. The Ts won by eliminating the defenders; one of your team survived.

- `+3.4 s` A T player detonated a molotov in Apartments
- `+3.8 s` A CT player detonated a flash in Top of Mid
- `+5.3 s` A CT player detonated a flash in Middle
- `+12.0 s` A T player killed a CT player with an AK-47 in Arch
- `+12.6 s` A CT player killed a T player with an M4A1-S (headshot) in Middle
- `+17.2 s` A player picked up the bomb in Top of Mid
- `+22.9 s` A player began planting at A
- `+26.0 s` A player planted the bomb at A
- `+30.9 s` A T player killed a CT player with an AK-47 (headshot) in A site
- `+30.9 s` The attackers win: all defenders eliminated.

What to remember (proposed): Decide when to stop gathering information: keep reading while the clock is long and positions are unknown, and commit once the clock or the numbers force the plan.

## Assumptions that need judgement

- The draft treats "hit the site together" as the best line and a plant-then-crossfire as close behind; both rankings come from templates.
- The Arch sighting depends partly on where the source team walked; a team on another route might not see it at the same time.
- Retrieving the dropped bomb is folded into the action rather than offered as its own choice.
- Follow-up matrix: the Arch sighting leaves the execute strongest. With 24 s left, playing slowly or faking collapses to 25, so a team that played slowly is credited 80 for executing now.
- Team comms may have provided information the demo cannot show (callouts, sound cues, teammates' kill positions).
- The historical line is not assumed to be correct; it only records what this team did.
- Sightings come from the demo's spotted flag, which can register enemies a player never consciously noticed.
- Detected by a heuristic; not yet reviewed by a human CS2 reviewer.
- Late round with no plant: the attackers' options depend on how much of the round clock they are willing to spend, which is a judgement call.
- The follow-up information arrives less than 2 s before the next kill, leaving almost no time to react.
- The follow-up is the first material change the demo shows 3-25 s later; teams may have learned of it earlier through comms.
- Follow-up reaction window is only 0.98 s: in the source round the situation changed again almost at once, so the responses may not be meaningfully playable. Confirm the window is long enough or author a different follow-up.

## Questions for the reviewer

1. With the bomb about 700 units away and 35 s left, is committing now clearly best, or can a 2v2 with one player on 44 HP be played slower?
2. Which site does "the site" mean here, and can B be reached in time from Middle after picking up the bomb?
3. Is a fake with two players and one molotov ever playable at 35 s, or should it score as clearly wrong?
4. Should picking up the bomb be an explicit option, or is it implied by every attacking line?
5. Does the Arch sighting work as a follow-up for every line, or only for the route the source team took?
6. Is the 44 HP player relevant enough to change the ranking?
7. With 24 s left and one defender now seen in Arch, is executing the only sound line for every team, including one that faked, or can a slow team still play for a late pick?

## Your verdict

Answer the questions above in a sentence each, then record the review in the case file:

```json
"reviewers": [{ "name": "<your name>", "reviewedAt": "YYYY-MM-DD", "verdict": "approved | changes_requested", "notes": "<answers and required edits>" }]
```

Only a named human CS2 reviewer can approve. `approved` plus `status: "tactically_reviewed"` is the next step; `changes_requested` keeps it as a draft.
