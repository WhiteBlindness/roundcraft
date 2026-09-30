# Review packet: 5v4 with 74 s left and no plant on Mirage

`case_mirage_opening_pick_cae8a3` · de_mirage · T side · status **draft** · recommendation **REVIEW FIRST**

Demo-grounded synthetic draft. Options, debrief and rubric are proposals generated from the source round; nothing here has had human tactical review. Time budget: 5–10 minutes.

Play it locally: `npm run content:preview -- case_mirage_opening_pick_cae8a3` then `npm run dev` and open Today.

## Why this case

Five attackers with SMGs and a scout lead 5v4 after an opening kill, 40 seconds into the round, carrying the bomb in Palace. One defender with a FAMAS is visible in Middle; three are unknown, with recent defender smokes and a molotov in Apartments. The first call is a posture choice (default, lurk, fake or execute). The follow-up is where this case earns its place: a second defender appears in Underpass, and with two of four defenders located the draft's strongest line flips from playing slowly to executing now. It is the one case in the queue where the follow-up tests a genuine change of mind, so the reviewer needs to decide whether that flip is right.

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
case_mirage_opening_pick_cae8a3: 320 combinations; min 51, p25 68, median 75, p75 81, max 94; 100s: 0

Main call (best total per line):
   94  Keep the default and take information first / Play slowly and listen for rotations
   89  Keep the default and take information first / Probe the nearest known contact
   85  Use a lone lurker to pull a rotation / Send one player alone behind the defence
   85  Fake one site, then rotate to the other / Sell the fake with utility
   80  Use a lone lurker to pull a rotation / Send two players wide with a trade
   80  Fake one site, then rotate to the other / Fake quietly and rotate early
   75  Commit to an execute now / Use utility together to take space
   70  Commit to an execute now / Keep some utility back for the post-plant

Follow-up against the locked line (best qualifier and evidence pair for that line):
  locked: Use a lone lurker to pull a rotation / Send one player alone behind the defence  (main 38/50, evidence 20/20)
    Execute on the site now                 follow-up 27/30  total  85
    Keep the lurk going to pull a rotation  follow-up 22/30  total  80
    Fake here and rotate away               follow-up 19/30  total  77
    Keep playing slowly for information     follow-up 16/30  total  74
  locked: Keep the default and take information first / Play slowly and listen for rotations  (main 50/50, evidence 20/20)
    Execute on the site now                 follow-up 24/30  total  94
    Keep playing slowly for information     follow-up 23/30  total  93
    Keep the lurk going to pull a rotation  follow-up 17/30  total  87
    Fake here and rotate away               follow-up 17/30  total  87
  locked: Fake one site, then rotate to the other / Sell the fake with utility  (main 38/50, evidence 20/20)
    Execute on the site now                 follow-up 27/30  total  85
    Fake here and rotate away               follow-up 22/30  total  80
    Keep the lurk going to pull a rotation  follow-up 19/30  total  77
    Keep playing slowly for information     follow-up 16/30  total  74
  locked: Commit to an execute now / Use utility together to take space  (main 25/50, evidence 20/20)
    Execute on the site now                 follow-up 30/30  total  75
    Keep the lurk going to pull a rotation  follow-up 20/30  total  65
    Fake here and rotate away               follow-up 20/30  total  65
    Keep playing slowly for information     follow-up 17/30  total  62

Stress lines:
  good main -> stays with it                93  (follow-up 23/30: Keep the default and take information first -> Keep playing slowly for information)
  good main -> unnecessary reversal         87  (follow-up 17/30: Keep the default and take information first -> Keep the lurk going to pull a rotation)
  weak main -> best correction              75  (follow-up 30/30: Commit to an execute now -> Execute on the site now)
  weak main -> stubborn continuation        75  (follow-up 30/30: Commit to an execute now -> Execute on the site now)
  plausible alternative -> stays with it    80  (follow-up 22/30: Use a lone lurker to pull a rotation -> Keep the lurk going to pull a rotation)

Follow-up checks:
  no findings
```

## Follow-up

A new sighting: About 12 seconds later, a defender appears in Underpass.

- **new** — One defender is visible in Underpass right now with an M4A4.
- **new** — The positions of two defenders are unknown.
- **changed** — About 63 seconds now remain on the round clock.

Proposed follow-up quality (0–100, worth up to 30 points) by the line the player locked (rows) and the answer they give now (columns):

| Locked line | Keep playing slowly for information | Execute on the site now | Keep the lurk going to pull a rotation | Fake here and rotate away |
| --- | --- | --- | --- | --- |
| Use a lone lurker to pull a rotation | 55 | 90 | 75 | 65 |
| Keep the default and take information first | 75 | 80 | 55 | 55 |
| Fake one site, then rotate to the other | 55 | 90 | 65 | 75 |
| Commit to an execute now | 55 | 100 | 65 | 65 |

The update changes the strongest line: before, Keep the default and take information first; after, Commit to an execute now.

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
- Follow-up matrix: locating a second defender flips the strongest line from the slow default (100 before, 75 after) to the execute (50 before, 100 after). The rule behind it is that an execute becomes best once the team has utility, level or better numbers and at least 40% of the defenders located.
- Team comms may have provided information the demo cannot show (callouts, sound cues, teammates' kill positions).
- The historical line is not assumed to be correct; it only records what this team did.
- Sightings come from the demo's spotted flag, which can register enemies a player never consciously noticed.
- Detected by a heuristic; not yet reviewed by a human CS2 reviewer.
- Opening pick: the state right after the first kill is shaped by the first minute's utility and positions, which the brief only summarises.
- The follow-up information arrives less than 2 s before the next kill, leaving almost no time to react.
- The follow-up is the first material change the demo shows 3-25 s later; teams may have learned of it earlier through comms.
- Follow-up reaction window is only 1.53 s: in the source round the situation changed again almost at once, so the responses may not be meaningfully playable. Confirm the window is long enough or author a different follow-up.

## Questions for the reviewer

1. When the second defender appears in Underpass with 63 s left, does that justify switching from the slow default to an execute now, as the draft proposes (80 for switching, 75 for continuing)?
2. At 5v4 with the bomb near A and 74 s left, is taking information first really best, or is an early A execute standard?
3. Does the opening kill create a window to exploit immediately?
4. Do the defender smokes and molotov in Apartments signal an aggressive defender play?
5. What should a fake mean with one smoke and five flashes?
6. Is a lurk sensible when one teammate is on very low HP?
7. Is this case specific enough to teach something, or is it a generic mid-round posture question that should be dropped?

## Your verdict

Answer the questions above in a sentence each, then record the review in the case file:

```json
"reviewers": [{ "name": "<your name>", "reviewedAt": "YYYY-MM-DD", "verdict": "approved | changes_requested", "notes": "<answers and required edits>" }]
```

Only a named human CS2 reviewer can approve. `approved` plus `status: "tactically_reviewed"` is the next step; `changes_requested` keeps it as a draft.
