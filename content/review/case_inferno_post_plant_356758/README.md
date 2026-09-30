# Review packet: 2v2 retake at A on Inferno

`case_inferno_post_plant_356758` · de_inferno · CT side · status **draft** · recommendation **REVIEW FIRST**

Demo-grounded synthetic draft. Options, debrief and rubric are proposals generated from the source round; nothing here has had human tactical review. Time budget: 5–10 minutes.

Play it locally: `npm run content:preview -- case_inferno_post_plant_356758` then `npm run dev` and open Today.

## Why this case

Two defenders in CT Spawn face a bomb planted at A about 4 seconds earlier, 36 seconds before detonation. Both carry defuse kits and full armour but no utility. One attacker with an AK-47 was last seen in A site 14 seconds ago; the planter is unknown. It is the cleanest brief in the set: every fact comes from what the defenders could know. The follow-up (an enemy smoke in Balcony) is an attacker action, although a team that stayed in CT Spawn might not have seen it. The open question is the classic one: retake together now, or wait and commit late to a kit defuse.

## Tactical snapshot

| Player-known view (what the brief may use) | Ground truth (reviewer only, never shown to players) |
| --- | --- |
| ![player-known](player-known.svg) | ![ground truth](ground-truth.svg) |

## Brief as the player sees it

- **confirmed** — You play the CT side on Inferno.
- **confirmed** — The bomb is planted at A; 36 s remain on the bomb timer.
- **inferred** — The bomb was planted 4 s ago, so at least one attacker was at site A moments ago. Basis: plant announcement.
- **last seen** — One attacker was last seen in A site 14 s ago with an AK-47.
- **confirmed** — 2 CTs alive against 2 Ts.
- **confirmed** — Your players: AWP + USP-S, 100 HP, full armour; M4A1-S + P2000, 100 HP, full armour.
- **confirmed** — 2 of your 2 alive players carry a defuse kit.
- **confirmed** — Your team has no utility left.
- **confirmed** — The attackers detonated two molotovs in Pit 16 s ago.
- **confirmed** — The attackers detonated a smoke in Library 7 s ago.
- **confirmed** — Score: your team 0, the attackers 4.
- **confirmed** — Your team is positioned: 2 in CT Spawn.
- **unknown** — The position of one attacker is unknown.

Evidence options (pick two): Bomb timer · Alive count · Attacker last seen in A site · Own utility · Defuse kit availability

## Recent timeline before the decision (source round)

- `-16.1 s` A T player detonated a molotov in Pit
- `-16.0 s` A T player detonated a molotov in Pit
- `-15.5 s` A CT player killed a T player with an M4A4 in A site
- `-15.4 s` A T player died from world damage
- `-14.3 s` A T player killed a CT player with an AK-47 in Pit
- `-6.9 s` A player began planting at A
- `-6.7 s` A T player detonated a smoke in Library
- `-3.8 s` A player planted the bomb at A

## Proposed lines and scoring (proposal, not truth)

| Action | Qualifier | Main-call quality (0–100) |
| --- | --- | --- |
| Retake together, clearing A site first | Clear the known position together and trade the first contact | 100 |
| Retake together, clearing A site first | Move as one stack and trade every contact | 90 |
| Wait for information before committing | Hold back and go for a late defuse | 75 |
| Retake together, clearing A site first | Send one player ahead to probe while the other follows | 75 |
| Wait for information before committing | Listen for footsteps before moving | 65 |
| Save the weapons | Everyone saves and avoids contact | 25 |
| Save the weapons | Save, but take a trade if an attacker is met | 15 |

Every combination scored with the production 50/20/30 model:

```
case_inferno_post_plant_356758: 210 combinations; min 21, p25 46, median 64, p75 75, max 100; 100s: 1

Main call (best total per line):
  100  Retake together, clearing A site first / Clear the known position together and trade the first contact
   95  Retake together, clearing A site first / Move as one stack and trade every contact
   88  Retake together, clearing A site first / Send one player ahead to probe while the other follows
   82  Wait for information before committing / Hold back and go for a late defuse
   77  Wait for information before committing / Listen for footsteps before moving
   54  Save the weapons / Everyone saves and avoids contact
   49  Save the weapons / Save, but take a trade if an attacker is met

Follow-up against the locked line (best qualifier and evidence pair for that line):
  locked: Wait for information before committing / Hold back and go for a late defuse  (main 38/50, evidence 20/20)
    Go into the retake together now          follow-up 24/30  total  82
    Hold off and keep gathering information  follow-up 15/30  total  73
    Save the weapons from here               follow-up  1/30  total  59
  locked: Retake together, clearing A site first / Clear the known position together and trade the first contact  (main 50/50, evidence 20/20)
    Go into the retake together now          follow-up 30/30  total 100
    Hold off and keep gathering information  follow-up  9/30  total  79
    Save the weapons from here               follow-up  0/30  total  70
  locked: Save the weapons / Everyone saves and avoids contact  (main 13/50, evidence 20/20)
    Go into the retake together now          follow-up 21/30  total  54
    Hold off and keep gathering information  follow-up  9/30  total  42
    Save the weapons from here               follow-up  7/30  total  40

Stress lines:
  good main -> stays with it               100  (follow-up 30/30: Retake together, clearing A site first -> Go into the retake together now)
  good main -> unnecessary reversal         79  (follow-up  9/30: Retake together, clearing A site first -> Hold off and keep gathering information)
  weak main -> best correction              54  (follow-up 21/30: Save the weapons -> Go into the retake together now)
  weak main -> stubborn continuation        40  (follow-up  7/30: Save the weapons -> Save the weapons from here)
  plausible alternative -> stays with it    73  (follow-up 15/30: Wait for information before committing -> Hold off and keep gathering information)

Follow-up checks:
  no findings
```

## Follow-up

New enemy utility: About 10 seconds later, the attackers detonate a smoke in Balcony.

- **new** — The attackers set off a smoke in Balcony just now.
- **changed** — About 26 seconds now remain on the bomb timer.

Proposed follow-up quality (0–100, worth up to 30 points) by the line the player locked (rows) and the answer they give now (columns):

| Locked line | Hold off and keep gathering information | Go into the retake together now | Save the weapons from here |
| --- | --- | --- | --- |
| Wait for information before committing | 50 | 80 | 5 |
| Retake together, clearing A site first | 30 | 100 | 0 |
| Save the weapons | 30 | 70 | 25 |

The update leaves the strongest line unchanged: before, Retake together, clearing A site first; after, Retake together, clearing A site first.

Follow-up caveats:

- The new information exists because the source team moved; a team on another line would not see it now.

## What happened in the source round (reveal, not the answer key)

In the source round, over the next 10 s: 2 players moved from CT Spawn to Arch. Over the next 20 s the team used no utility and got 1 kill and lost no players. Defuses began 23 s and 28 s after the decision; none was completed. The Ts won by eliminating the defenders; none of your team survived.

- `+10.2 s` A T player detonated a smoke in Balcony
- `+16.4 s` A CT player killed a T player with an M4A1-S (headshot) in Pit
- `+23.2 s` A player began defusing at A
- `+27.6 s` A player began defusing at A
- `+27.9 s` A T player killed a CT player with an AK-47 (headshot) in A site
- `+31.5 s` A T player killed a CT player with a Glock-18 in Graveyard
- `+31.5 s` The attackers win: all defenders eliminated.

What to remember (proposed): On a retake, weigh the seconds a defuse needs against what you actually know: commit while the clock and the numbers support it, and save when they do not.

## Assumptions that need judgement

- The draft ranks a grouped retake above a late kit defuse. That ranking comes from a generic retake template, not from this round's history (the source team retook together and lost).
- The Balcony smoke is only observable if the defenders have moved towards A; a team that waits in CT Spawn might not see it.
- Neither the AWP nor the lack of utility changes the ranking in the current rubric.
- Follow-up matrix: the Balcony smoke leaves the grouped retake strongest (staying with it scores 100). A team that waited is credited 80 for going in now and 50 for waiting on, because only 26 s remain.
- Team comms may have provided information the demo cannot show (callouts, sound cues, teammates' kill positions).
- The historical line is not assumed to be correct; it only records what this team did.
- Sightings come from the demo's spotted flag, which can register enemies a player never consciously noticed.
- Detected by a heuristic; not yet reviewed by a human CS2 reviewer.
- Post-plant: the bomb timer, not the round clock, is the deadline; whether to retake or save depends on information the demo cannot show about the enemy's utility.
- The last sighting of an enemy in A site (last seen with an AK-47) is 14 s old, so that position may be stale.
- The follow-up sighting exists because the source team moved into position; a team that chose another line would not see it at this moment.
- The follow-up is the first material change the demo shows 3-25 s later; teams may have learned of it earlier through comms.

## Questions for the reviewer

1. Two kits, full armour, no utility, 36 s left, one AK-47 last seen in A site and one unknown attacker: is a quick grouped retake or a late kit defuse the better line? Are both defensible?
2. Is saving the AWP and the M4A1-S a defensible line at 2v2 with 36 s left, or should it score as a clear mistake?
3. Which entrance does "retake together" realistically use from CT Spawn: Arch, Library (smoked 7 s ago) or another?
4. Does a Balcony smoke 10 s later change what a two-player retake should do, or does it only confirm that the attackers hold A?
5. Is "hold back and commit late to a kit defuse" a real line with 36 s left, and by when must it start?
6. Is an AWP a liability in a close A-site retake, and should the brief or rubric say so?
7. After the Balcony smoke, with 26 s left and two kits, is a team that waited still in time to retake (the draft gives 80 for going in now), and is waiting on really as weak as 50?

## Your verdict

Answer the questions above in a sentence each, then record the review in the case file:

```json
"reviewers": [{ "name": "<your name>", "reviewedAt": "YYYY-MM-DD", "verdict": "approved | changes_requested", "notes": "<answers and required edits>" }]
```

Only a named human CS2 reviewer can approve. `approved` plus `status: "tactically_reviewed"` is the next step; `changes_requested` keeps it as a draft.
