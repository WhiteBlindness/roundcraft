# Review packet: 3v3 hold or rotate as the defenders on Inferno

`case_inferno_man_advantage_shift_927fb7` · de_inferno · CT side · status **draft** · recommendation **NEEDS TACTICAL DECISION**

Demo-grounded synthetic draft. Options, debrief and rubric are proposals generated from the source round; nothing here has had human tactical review. Time budget: 5–10 minutes.

Play it locally: `npm run content:preview -- case_inferno_man_advantage_shift_927fb7` then `npm run dev` and open Today.

## Why this case

Three defenders (two in Banana, one in Apartments) with SMGs and a FAMAS face three attackers 22 seconds into the round, with no plant, 92 seconds left and an 11-2 lead. A trade has just happened in Middle: an attacker died there 1.8 seconds ago and a teammate 1.4 seconds ago, to a Desert Eagle. Two attackers were seen 1.5 seconds ago, one in Middle and one in T Ramp, and the bomb carrier was last seen in T Ramp 13 seconds ago. The question is whether to hold the current split or rotate a player. The follow-up, the carrier appearing in Banana, is a genuine enemy-side move, but the draft's best line rotates a player towards Middle, away from Banana.

## Tactical snapshot

| Player-known view (what the brief may use) | Ground truth (reviewer only, never shown to players) |
| --- | --- |
| ![player-known](player-known.svg) | ![ground truth](ground-truth.svg) |

## Brief as the player sees it

- **confirmed** — You play the CT side on Inferno.
- **confirmed** — The bomb has not been planted; about 92 s remain on the round clock.
- **last seen** — The bomb carrier was last seen in T Ramp 13 s ago with a Desert Eagle.
- **confirmed** — 3 CTs alive against 3 Ts.
- **confirmed** — Your players: MP9 + USP-S, 100 HP, full armour; MP9 + USP-S, 100 HP, full armour; FAMAS + Dual Berettas, 100 HP, full armour.
- **confirmed** — 1 of your 3 alive players carries a defuse kit.
- **confirmed** — Your team has 1 smoke, 4 flashes, 2 molotovs and 1 HE grenade left.
- **confirmed** — Score: your team 11, the attackers 2.
- **confirmed** — Your team is positioned: 2 in Banana, 1 in Apartments.
- **confirmed** — One attacker was spotted in Middle 1.5 s ago with a Desert Eagle.
- **confirmed** — One attacker was spotted in T Ramp 1.5 s ago with a Desert Eagle.
- **confirmed** — An attacker was killed in Middle 1.8 s ago.
- **confirmed** — A teammate was killed in Middle 1.4 s ago by a Desert Eagle.

Evidence options (pick two): Attacker spotted in Middle · Attacker spotted in T Ramp · Round clock · Alive count · Own utility

## Recent timeline before the decision (source round)

- `-13.4 s` A CT player killed a T player with an M4A1-S in T Ramp
- `-10.5 s` A CT player detonated an HE grenade in Banana
- `-7.9 s` A CT player detonated a smoke in Banana
- `-6.3 s` A T player detonated a flash in Banana
- `-1.8 s` A CT player killed a T player with an M4A1-S (headshot) in Middle
- `-1.4 s` A T player killed a CT player with a Desert Eagle in Middle

## Proposed lines and scoring (proposal, not truth)

| Action | Qualifier | Main-call quality (0–100) |
| --- | --- | --- |
| Rotate a player towards Middle | Rotate one player and keep the rest in place | 100 |
| Rotate a player towards Middle | Rotate two players and leave one behind | 90 |
| Take information before committing | Listen and read footsteps before moving | 75 |
| Hold the current setup | Stay in the set positions and trade | 75 |
| Take information before committing | Probe with a trade behind the prober | 65 |
| Hold the current setup | Use utility to delay the first contact | 65 |
| Fall back and play for a retake if they plant | Fall back together and regroup | 50 |
| Fall back and play for a retake if they plant | Fall back but hold one angle | 40 |

Every combination scored with the production 50/20/30 model:

```
case_inferno_man_advantage_shift_927fb7: 320 combinations; min 47, p25 61, median 71, p75 78, max 100; 100s: 1

Main call (best total per line):
  100  Rotate a player towards Middle / Rotate one player and keep the rest in place
   95  Rotate a player towards Middle / Rotate two players and leave one behind
   82  Take information before committing / Listen and read footsteps before moving
   82  Hold the current setup / Stay in the set positions and trade
   77  Take information before committing / Probe with a trade behind the prober
   77  Hold the current setup / Use utility to delay the first contact
   66  Fall back and play for a retake if they plant / Fall back together and regroup
   61  Fall back and play for a retake if they plant / Fall back but hold one angle

Follow-up against the locked line (best qualifier and evidence pair for that line):
  locked: Take information before committing / Listen and read footsteps before moving  (main 38/50, evidence 20/20)
    Shift a player towards the latest contact  follow-up 24/30  total  82
    Hold and take more information             follow-up 22/30  total  80
    Keep the current setup                     follow-up 19/30  total  77
    Fall back and set up for a retake          follow-up  9/30  total  67
  locked: Hold the current setup / Stay in the set positions and trade  (main 38/50, evidence 20/20)
    Shift a player towards the latest contact  follow-up 24/30  total  82
    Keep the current setup                     follow-up 22/30  total  80
    Hold and take more information             follow-up 19/30  total  77
    Fall back and set up for a retake          follow-up  9/30  total  67
  locked: Rotate a player towards Middle / Rotate one player and keep the rest in place  (main 50/50, evidence 20/20)
    Shift a player towards the latest contact  follow-up 30/30  total 100
    Hold and take more information             follow-up 17/30  total  87
    Keep the current setup                     follow-up 17/30  total  87
    Fall back and set up for a retake          follow-up  6/30  total  76
  locked: Fall back and play for a retake if they plant / Fall back together and regroup  (main 25/50, evidence 20/20)
    Shift a player towards the latest contact  follow-up 21/30  total  66
    Hold and take more information             follow-up 17/30  total  62
    Keep the current setup                     follow-up 17/30  total  62
    Fall back and set up for a retake          follow-up 15/30  total  60

Stress lines:
  good main -> stays with it               100  (follow-up 30/30: Rotate a player towards Middle -> Shift a player towards the latest contact)
  good main -> unnecessary reversal         87  (follow-up 17/30: Rotate a player towards Middle -> Hold and take more information)
  weak main -> best correction              66  (follow-up 21/30: Fall back and play for a retake if they plant -> Shift a player towards the latest contact)
  weak main -> stubborn continuation        60  (follow-up 15/30: Fall back and play for a retake if they plant -> Fall back and set up for a retake)
  plausible alternative -> stays with it    80  (follow-up 22/30: Take information before committing -> Hold and take more information)

Follow-up checks:
  no findings
```

## Follow-up

A new sighting: About 13 seconds later, the bomb carrier appears in Banana.

- **new** — The bomb carrier is visible in Banana right now with a Desert Eagle.
- **changed** — About 80 seconds now remain on the round clock.

Proposed follow-up quality (0–100, worth up to 30 points) by the line the player locked (rows) and the answer they give now (columns):

| Locked line | Hold and take more information | Fall back and set up for a retake | Shift a player towards the latest contact | Keep the current setup |
| --- | --- | --- | --- | --- |
| Take information before committing | 75 | 30 | 80 | 65 |
| Hold the current setup | 65 | 30 | 80 | 75 |
| Rotate a player towards Middle | 55 | 20 | 100 | 55 |
| Fall back and play for a retake if they plant | 55 | 50 | 70 | 55 |

The update leaves the strongest line unchanged: before, Rotate a player towards Middle; after, Rotate a player towards Middle.

Follow-up caveats:

- The new information exists because the source team moved; a team on another line would not see it now.
- The next kill follows 1.4 s after the new information.

## What happened in the source round (reveal, not the answer key)

In the source round, over the next 10 s: 2 players held position in Banana; 1 player moved from Apartments to Second Mid. Over the next 20 s the team used 1 HE grenade, 1 molotov and got 1 kill and lost 2 players. The Ts won by eliminating the defenders; none of your team survived.

- `+1.1 s` A CT player detonated an HE grenade in Banana
- `+9.7 s` A CT player detonated a molotov in Banana
- `+14.5 s` A player dropped the bomb in Banana
- `+14.5 s` A CT player killed a T player with an MP9 in Banana
- `+15.2 s` A T player killed a CT player with a Desert Eagle in Banana
- `+17.7 s` A T player killed a CT player with a Desert Eagle (headshot) in Banana
- `+20.4 s` A CT player killed a T player with a FAMAS in Middle
- `+21.6 s` A T player killed a CT player with a Desert Eagle (headshot) in Underpass
- `+21.6 s` The attackers win: all defenders eliminated.

What to remember (proposed): Move weight only for information you trust: a fresh sighting justifies a rotation, an old or unconfirmed one usually does not.

## Assumptions that need judgement

- The draft's best line (rotate one player towards Middle) comes from a template. The source team held Banana and killed the carrier there.
- The follow-up is only visible to a team that still has players in Banana.
- The attackers' pistols suggest an eco or a force buy, but the brief does not state their economy.
- Follow-up matrix: the draft's priors do not weigh where a sighting is relative to the team, so after the carrier appears in Banana they still rate moving a player towards Middle as the strongest line (100) and holding as 75. A reviewer must set this row by hand.
- Team comms may have provided information the demo cannot show (callouts, sound cues, teammates' kill positions).
- The historical line is not assumed to be correct; it only records what this team did.
- Sightings come from the demo's spotted flag, which can register enemies a player never consciously noticed.
- Detected by a heuristic; not yet reviewed by a human CS2 reviewer.
- Man-advantage shift: kills leave several defensible follow-ups (trade, hold, rotate); the detector does not judge which is best.
- The last sighting of an enemy in T Ramp (last seen with a Desert Eagle) is 13 s old, so that position may be stale.
- The follow-up sighting exists because the source team moved into position; a team that chose another line would not see it at this moment.
- The follow-up information arrives less than 2 s before the next kill, leaving almost no time to react.

## Questions for the reviewer

1. Once the bomb carrier appears in Banana, which line should score best for each locked call: keep a player moving towards Middle, keep the setup, or take more information? The draft's answer (Middle) ignores where the carrier is.
2. With the carrier last seen in T Ramp 13 s ago and two fresh sightings in Middle and T Ramp, is rotating a player away from Banana sensible, or should Banana stay stacked?
3. A teammate has just died in Middle to a Desert Eagle: does that argue for sending a player towards Middle, or against it?
4. Is "towards Middle" meaningful for the Apartments player, or should the option name a specific position?
5. Is "fall back" ever a real option at 3v3 with no plant and 92 s left?
6. Once the carrier appears in Banana, is keeping the setup really worse than adjusting it?
7. Do Desert Eagle attackers indicate an eco or a force buy, and should the brief say so?
8. Are "rotate one" and "rotate two" meaningfully different at 3v3?

## Your verdict

Answer the questions above in a sentence each, then record the review in the case file:

```json
"reviewers": [{ "name": "<your name>", "reviewedAt": "YYYY-MM-DD", "verdict": "approved | changes_requested", "notes": "<answers and required edits>" }]
```

Only a named human CS2 reviewer can approve. `approved` plus `status: "tactically_reviewed"` is the next step; `changes_requested` keeps it as a draft.
