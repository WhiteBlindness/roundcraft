# Review packet: 5v4 with 74 s left and no plant on Mirage

`case_mirage_opening_pick_cae8a3` · de_mirage · T side · status **draft** · recommendation **KEEP**

Demo-grounded synthetic draft. Options, debrief and rubric are proposals generated from the source round; nothing here has had human tactical review. Time budget: 5–10 minutes.

Play it locally: `npm run content:preview -- case_mirage_opening_pick_cae8a3` then `npm run dev` and open Today.

## Why this case

Five attackers with SMGs and a scout lead 5v4 after an opening kill, 40 seconds into the round, carrying the bomb in Palace. One defender with a FAMAS is visible in Middle; three are unknown, with recent defender smokes and a molotov in Apartments. The information handling is clean, but the decision is generic (default, probe, lurk, fake or commit), and the follow-up comes from a teammate's own movement into Underpass. Worth a second wave once the first four have been reviewed.

## Tactical snapshot

| Player-known view (what the brief may use) | Ground truth (reviewer only, never shown to players) |
| --- | --- |
| ![player-known](player-known.svg) | ![ground truth](ground-truth.svg) |

## Brief as the player sees it

- **confirmed** — You play the T side on Mirage.
- **confirmed** — The bomb has not been planted; about 74 s remain on the round clock.
- **confirmed** — Your team is carrying the bomb in Palace Interior.
- **confirmed** — 5 Ts alive against 4 CTs.
- **confirmed** — Your players have 100, 100, 74, 48, 1 HP; two AK-47s, two MAC-10s, one SSG 08; four armoured.
- **confirmed** — Your team has 1 smoke and 5 flashes left.
- **confirmed** — The defenders detonated a molotov in Apartments 16 s ago.
- **confirmed** — The defenders detonated a smoke in Apartments 8 s ago.
- **confirmed** — The defenders detonated a smoke in Middle 13 s ago.
- **confirmed** — Score: your team 1, the defenders 1.
- **confirmed** — Your team is positioned: 2 in Middle, 1 in Apartments, 1 in Palace Interior, 1 in Top of Mid.
- **confirmed** — One defender is visible in Middle right now with a FAMAS.
- **confirmed** — A defender was killed in Ladder 1.9 s ago.
- **unknown** — The positions of three defenders are unknown.

Evidence options (pick two): Round clock · Alive count · Defender spotted in Middle · Own utility · Unknown defender positions

## Recent timeline before the decision (source round)

- `-19.5 s` A CT player detonated an HE grenade in Apartments
- `-17.6 s` A T player detonated a flash in Ladder
- `-17.4 s` A T player detonated a smoke in Catwalk
- `-16.2 s` A CT player detonated a flash in Middle
- `-16.0 s` A CT player detonated a molotov in Apartments
- `-16.0 s` A T player detonated a smoke in Catwalk
- `-12.9 s` A T player detonated an HE grenade in Catwalk
- `-12.9 s` A CT player detonated a smoke in Middle
- `-8.5 s` A CT player detonated a smoke in Apartments
- `-8.4 s` A CT player detonated an HE grenade in Palace Interior
- `-1.9 s` A T player killed a CT player with a MAC-10 (headshot) in Ladder

## Proposed lines and scoring (proposal, not truth)

| Action | Qualifier | Main-call quality (0–100) |
| --- | --- | --- |
| Keep the default and take information first | Play slowly and listen for rotations | 100 |
| Keep the default and take information first | Probe the nearest known contact | 90 |
| Use a lone lurker to pull a rotation | Send one player alone behind the defence | 75 |
| Fake one site, then rotate to the other | Sell the fake with utility | 75 |
| Use a lone lurker to pull a rotation | Send two players wide with a trade | 65 |
| Fake one site, then rotate to the other | Fake quietly and rotate early | 65 |
| Commit to an execute now | Use utility together to take space | 50 |
| Commit to an execute now | Keep some utility back for the post-plant | 40 |

Every combination scored with the production 50/20/30 model:

```
case_mirage_opening_pick_cae8a3: 320 combinations; min 43, p25 62, median 71, p75 80, max 98; 100s: 0
  best  98  Keep the default and take information first / Play slowly and listen for rotations
  best  93  Keep the default and take information first / Probe the nearest known contact
  best  85  Use a lone lurker to pull a rotation / Send one player alone behind the defence
  best  85  Fake one site, then rotate to the other / Sell the fake with utility
  best  80  Use a lone lurker to pull a rotation / Send two players wide with a trade
  best  80  Fake one site, then rotate to the other / Fake quietly and rotate early
  best  73  Commit to an execute now / Use utility together to take space
  best  68  Commit to an execute now / Keep some utility back for the post-plant
  follow-up    18 / 30  Stick to the line you chose
  follow-up 16-17 / 30  Slow down and gather more information
  follow-up    28 / 30  Change your line to use the new information
  follow-up     9 / 30  Drop the line you chose and reset
```

## Follow-up

A new sighting: About 12 seconds later, a defender appears in Underpass.

- **new** — One defender is visible in Underpass right now with an M4A4.
- **new** — The positions of two defenders are unknown.
- **changed** — About 63 seconds now remain on the round clock.

Responses and proposed follow-up quality: Change your line to use the new information = 92; Stick to the line you chose = 60; Slow down and gather more information = 55; Drop the line you chose and reset = 30

Follow-up caveats:

- The next kill follows 1.5 s after the new information.

## What happened in the source round (reveal, not the answer key)

In the source round, over the next 10 s: 4 players held position in Apartments, Middle, Palace Interior and Top of Mid; 1 player moved from Middle to Underpass. Over the next 20 s the team used 3 flashes and got 1 kill and lost no players. The Ts won by eliminating the defenders; 4 of your team survived.

- `+13.0 s` A T player killed a CT player with an AK-47 (headshot) in Underpass
- `+16.5 s` A T player detonated a flash in Shop
- `+17.8 s` A T player detonated a flash in Shop
- `+19.6 s` A T player detonated a flash in Sniper's Nest
- `+23.0 s` A T player killed a CT player with an SSG 08 (headshot) in CT Spawn
- `+25.0 s` A T player killed a CT player with an AK-47 (headshot) in B site
- `+25.5 s` A CT player killed a T player with an M4A4 in Connector
- `+29.8 s` A T player killed a CT player with a MAC-10 (headshot) in CT Spawn
- `+29.8 s` The attackers win: all defenders eliminated.

What to remember (proposed): Decide when to stop gathering information: keep reading while the clock is long and positions are unknown, and commit once the clock or the numbers force the plan.

## Assumptions that need judgement

- The best line (play slowly and take information) matches what the source team did; the rubric was not built from history, but the match should be checked.
- One attacker is on very low HP, which the draft does not weigh.
- The follow-up depends on the source team's own movement.
- Team comms may have provided information the demo cannot show (callouts, sound cues, teammates' kill positions).
- The historical line is not assumed to be correct; it only records what this team did.
- Sightings come from the demo's spotted flag, which can register enemies a player never consciously noticed.
- Detected by a heuristic; not yet reviewed by a human CS2 reviewer.
- Opening pick: the state right after the first kill is shaped by the first minute's utility and positions, which the brief only summarises.
- The follow-up information arrives less than 2 s before the next kill, leaving almost no time to react.
- The follow-up is the first material change the demo shows 3-25 s later; teams may have learned of it earlier through comms.
- Follow-up reaction window is only 1.53 s: in the source round the situation changed again almost at once, so the responses may not be meaningfully playable. Confirm the window is long enough or author a different follow-up.

## Questions for the reviewer

1. At 5v4 with the bomb near A and 74 s left, is taking information first really best, or is an early A execute standard?
2. Does the opening kill create a window to exploit immediately?
3. Do the defender smokes and molotov in Apartments signal an aggressive defender play?
4. What should a fake mean with one smoke and five flashes?
5. Is a lurk sensible when one teammate is on very low HP?
6. Is this case specific enough to teach something, or is it a generic mid-round posture question that should be dropped?

## Your verdict

Answer the questions above in a sentence each, then record the review in the case file:

```json
"reviewers": [{ "name": "<your name>", "reviewedAt": "YYYY-MM-DD", "verdict": "approved | changes_requested", "notes": "<answers and required edits>" }]
```

Only a named human CS2 reviewer can approve. `approved` plus `status: "tactically_reviewed"` is the next step; `changes_requested` keeps it as a draft.
