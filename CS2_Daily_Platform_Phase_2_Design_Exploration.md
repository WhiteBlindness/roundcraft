# CS2 Daily Games Platform — Phase 2 Design Exploration

**Status:** Proposed for user selection  
**Date:** 31 August 2026  
**Source of truth:** Phase 1 PRD, approved to continue by the user on 31 August 2026  
**Scope:** Product and interface direction only. No repository, application code, Cloudflare resources, production assets, final product name, or final visual design.

---

## 1. Decision carried forward

The user's 31 August 2026 instruction to continue is recorded as approval of the four decisions that Phase 1 left open. Phase 1 therefore carries these locks into design:

- Phase 1 Strategy C remains the product strategy: one deep game-sense case is the flagship; the broader puzzle arcade remains a measured later expansion path.
- Beta uses deterministic 50/20/30 scoring: main call/execution, evidence, and follow-up.
- Closed beta begins at three released cases per week. A public daily cadence is conditional on content, retention, fairness, rights, and buffer gates.
- Free-text AI understanding waits until V1.1 shadow mode and cannot determine the official score.
- Credible human tactical reviewers remain an operational dependency. Design cannot substitute model consensus for them.

The Phase 1 product promise remains:

> **Read the round. Make the call. See what you missed.**

Phase 1 **Strategy C** means game-sense-first and remains fixed. The Phase 2 concepts below are called **Design A, Design B, and Design C** only to avoid confusing a visual candidate with that product-strategy decision.

All three designs below implement the same case contract:

`Today → Briefing → choose 2 of 5 evidence items → action + qualifier + confidence → lock → one follow-up → lock → canonical continuation → result summary → debrief detail → complete actions`

The comparison is therefore about how the product feels, where attention lives, and what users remember—not about changing the rules beneath each concept.

---

## 2. Shared design constitution

### Product shell

MVP navigation stays limited to:

- **Today** — current edition and completion state.
- **Cases** — released archive, review, and practice.
- **Progress** — participation first; knowledge lenses only after sample thresholds.

There is no top-level Arcade, Pro, Dashboard, Community, Leaderboard, or Store. Professional context belongs inside rights-cleared case debriefs. A later puzzle mechanic must earn its own surface through evidence.

During an active case, the persistent three-item global navigation is replaced by a compact case header with an accessible context-sensitive back control (`Back to Today` for the current official edition; `Back to Cases` for archive/practice) and a single utility menu. The fixed action area occupies the bottom safe area by itself. This prevents global navigation, browser chrome, sheets, and primary controls from colliding on a phone. Leaving the case preserves the compatible draft and never commits it.

Privacy is available from the Today/Cases/Progress shell footer or utility menu, not as a fourth primary destination. It contains:

- a plain-language pseudonymous-play and retention notice;
- Clear local progress;
- token-proven Delete server history;
- analytics categories and controls required by the privacy basis once approved through the Phase 1 legal/privacy gate;
- the warning that clearing browser storage may remove anonymous history.

### Shared Today and recovery-state contract

Every design uses the same wording and primary action. Styling may differ; meaning may not.

| Authoritative condition | Visible status | Primary action | Required treatment |
|---|---|---|---|
| Released, no attempt | New | Start case | Show edition/date, duration, broad focus |
| Compatible local draft or acknowledged partial state | In progress | Continue | Distinguish local draft from acknowledged state |
| Offline draft | Draft saved locally | Continue or Retry connection | State that it is not officially submitted or credited |
| Main commit acknowledged; response/stimulus lost | Main locked | Retry main submission | Retry the same main idempotency key and recover the first accepted `Main locked` state; no replacement line |
| Follow-up commit acknowledged; result response lost/delayed | Result pending | Retry result | Retry the same follow-up idempotency key; freeze the accepted branch; never permit a replacement response |
| Pre-commit revision conflict | Update required | Refresh case | Preserve compatible selections; no credit consumed |
| `decision_complete`, debrief incomplete | Decision complete | View debrief | Participation awarded; learning completion remains open |
| `debrief_complete` | Complete | Review or share | Show participation and stable result |
| Previous edition inside 12-hour grace | Previous case in progress | Resume previous | New edition remains primary; old completion credits its original UTC edition |
| Official window ended | Practice available | Play practice | Explicitly no official credit, streak, distribution, or lens impact |
| Corrected; score retained | Corrected | Read correction | Show original score, notice, and old/new case and rubric revision IDs |
| Corrected; deterministic recalculation valid | Recalculated | Review updated result | Show original and recalculated values plus both revision IDs |
| Corrected; fair recalculation impossible | Void | Read correction | Preserve attempted-user participation; remove edition from other denominators |
| Withdrawn for rights/source issue | Withdrawn | View neutral record | Preserve earned participation; void or retain score only as permitted; remove restricted case/debrief content |
| No release or outage before attempt | Unavailable | Retry later | No alternate edition and no consumed attempt |
| Local durable storage unavailable | Session-only play | Start or Continue session | Explain that history/credit may not survive loss of the attempt token |

Reset is always labelled `00:00 UTC`. The browser clock is display-only. During grace, `Resume previous` is a separate secondary action and never silently replaces the new edition.

Repeated or concurrent main/follow-up requests return the first accepted state for the relevant idempotency key. They never create or unlock a second official branch.

### Guidance modes

Every design exposes `Guided` and `Standard` from the briefing utility surface and allows switching before commitment without resetting choices, scroll position, schematic/text view, or focus context.

- **Standard** uses concise CS-native copy while keeping every critical fact and control explicit.
- **Guided** adds terminology definitions, expanded neutral context, and at most one authored coach cue naming a tactical dimension—not an action, evidence choice, rubric band, or answer-dependent conclusion.
- Taking the cue visibly marks the attempt `Assisted`; assisted completion still earns participation.
- Guided and Standard use the same edition, option IDs, ordering, answer contract, and deterministic score.
- Assisted attempts are segmented in distributions and excluded from lens performance until beta demonstrates score neutrality.
- Definitions remain available in both modes; Guided is never stigmatized or described as easier scoring.

### Shared secondary surfaces

**Provenance and affiliation**

- Every original case visibly says **“Synthetic scenario — editorial tactical analysis.”**
- Sourced rules/mechanical facts, reviewer judgment, accepted lines, and authored counterfactual interpretation occupy separately labelled groups.
- A professional case shows cleared event identity, historical ruleset, provenance, source limitations, and observed professional line separately from tactical assessment.
- A persistent product-level notice states that the product is unofficial and is not endorsed by Valve, teams, tournaments, or players.
- Recognizable geometry remains subject to a later legal-review checkpoint; Phase 2 assumes abstract original schematics.

**Fairness reporting**

After reveal, `Report a missing line or fact` opens a structured form with exactly: missing action, missing qualifier, missing evidence, incorrect disclosed fact, or other. MVP adds no free-text field. Submitted, pending, and resolved/correction states are visible without changing the official result locally.

**Practice, distributions, and progress**

- Practice is visibly labelled, unlocks only under the Phase 1 rules, and never changes official history, participation, retention, distributions, streaks, or lens progress.
- A lens shows performance only after five scored official samples in that lens and 15 scored official cases overall; before then it shows participation and exact sample count.
- Assisted attempts count for participation and remain excluded from lens performance until proven score-neutral.
- Distributions appear only after official completion and 100 eligible scored attempts; otherwise show `Not enough responses yet`.
- Rights withdrawal may reduce an archive entry to a neutral participation record.
- Reviewable historical cases visibly display `Rules as of [build/date]`, map/schematic revision, and correction status.

**Spoiler-safe sharing**

Every design provides native Web Share text and Copy text only. The payload contains edition/date, numeric score, the three components, confidence, and weekly participation. It contains no URL, image, map/team/player/event identity, action, evidence, rationale, follow-up event, answer-dependent prose, or verified badge. Cancelling returns focus to the result.

Illustrative format:

```text
CS Daily · Edition 018 · 74/100
Main 39/50 · Evidence 15/20 · Follow-up 20/30
Confidence: Leaning · 2 of the latest 3 editions
```

The wording and visual symbols remain provisional; the permitted data boundary is locked.

**Economy/Risk presentation**

Every Economy/Risk follow-up, regardless of design, visibly includes:

- versioned ruleset and price context;
- current money, saved equipment, loss-income state, score, and remaining-round horizon;
- each prevalidated package's items, total price, current-round reserve, and protected future reserve;
- explicit affordable/unaffordable status, although unaffordable pairs cannot be committed;
- a finite posture choice and a separately labelled finite allocation-priority choice;
- opponent economy labelled Confirmed, Last seen with age, Inferred with provenance, or Unknown.

The interface never exposes a free-form buy builder, arbitrary slider, or implied probability.

### Result and reveal order

After the follow-up commit is acknowledged, the player first receives the canonical continuation as an independently authored/documented record. The first evaluation block immediately after it contains:

1. main-call band;
2. follow-up band;
3. total score;
4. actual component points, for example `Main 39/50 · Evidence 15/20 · Follow-up 20/30`.

Evidence contributes points but has no separate band. Detailed debrief sections then follow the locked Phase 1 order. The later `Result` actions are Share, Review, Cases, and optional Practice—not a second or contradictory score reveal.

### Interface principles

1. One dominant task per state.
2. Tactical depth comes from disclosed information, not interface density.
3. The schematic and structured text are equivalent first-class views.
4. Confidence is visibly separate from scoring.
5. A local draft never looks officially committed.
6. The main call and follow-up each have an explicit immutable confirmation.
7. The canonical continuation is never presented as a branch caused by the player.
8. Multiple defensible lines receive equal visual dignity.
9. The debrief is gameplay and the transferable principle is the meaningful finish.
10. Desktop may add spatial context, never extra information.
11. There is no response timer and no response-time score. The round clock is frozen evidence or advances only through explicit continuation playback.

### Counter-Strike identity

Use:

- abstract zone-and-route geometry;
- frozen round, clock, bomb, manpower, health, utility, and economy notation;
- filled/open markers and solid/dashed/dotted route relationships;
- arrowheads for direction and explicit case-supplied travel-time labels where those facts matter;
- information-age labels;
- trade, timing, spacing, utility, economy, and objective language;
- quiet details such as coordinate rules, evidence ticks, and phase markers.

Do not use:

- copied radar art or recognizable map geometry without later legal approval;
- weapon images, screenshots, game audio, broadcast frames, logos, or player photography;
- neon cyberpunk, fake scan lines, military stencils, giant gamer typography, or constant glow;
- dashboards full of decorative telemetry;
- glassmorphism, confetti, XP, ranks, coins, or streak-loss anxiety.

### Accessibility and integrity

- Native checkboxes for evidence and native radio-group semantics for action, qualifier, confidence, and follow-up.
- 44×44 CSS-pixel minimum targets; primary controls prefer 48 pixels.
- One primary heading and clear landmark per state; textual step indicator with current-step semantics.
- Logical keyboard order: briefing → evidence → action → qualifier → confidence → confirm → follow-up.
- Full completion without sight, colour perception, animation, precision pointing, typing, hearing, or time pressure.
- Confirmed, last seen, inferred, unknown, team, and alive/dead states use text, shape, stroke, and pattern—not colour alone.
- Text equivalent includes topology, direction, travel relationships, information age, provenance, and deliberate unknowns.
- If visual geometry cannot express a travel or directional constraint without ambiguity, the labelled structured text is normative and the schematic must not imply a conflicting relationship.
- Switching diagram/text, Guided/Standard, orientation, or viewport preserves selections and state.
- The accessibility tree is a security surface. It may expose accessible names and descriptions matching visible choices and disclosed facts, but never hidden rankings, rubric values, future facts, canonical outcomes, or answer-dependent metadata.
- Result summary precedes detailed analysis and exposes total plus all three score components as text.
- `debrief_complete` cannot depend only on scrolling or an intersection observer; the final principle needs an explicit reachable completion state.

### Responsive baseline

- Phone portrait is canonical; no forced landscape.
- Mobile gutters: 16–20 px. Desktop gutters: 32–40 px.
- No required horizontal page scrolling, pinch zoom, swipe-only navigation, drag, hover, or pixel placement.
- The primary action area respects browser and safe-area insets without covering focused content.
- At 320 CSS px, labels wrap and supporting decoration disappears before facts do.
- At 200% zoom, the experience reflows to one column.
- Browser zoom remains enabled.

Palette names in this conceptual exploration do not establish compliant colour tokens. The selected design must define and test exact light/dark/forced-colour tokens, normal and large text contrast, non-text contrast, focus contrast, and all semantic states before design approval. Font licences and self-hosting/subsetting rights must also be verified before implementation.

### Motion baseline

- Selection feedback: about 100–180 ms.
- State transitions: about 180–300 ms.
- Optional reveal emphasis: no more than 300–500 ms and never blocks input.
- Prefer transform, opacity, borders, and one small vector transition at a time.
- Commitment waits for server acknowledgement; animation never disguises latency.
- No result is hidden behind an unskippable sequence.
- Reduced motion uses immediate state swaps, static diagrams, explicit changed/expired labels, and static continuation cards.

---

## 3. Design A — Editorial Tactical Desk

### Positioning

A carefully edited daily case file. The authority comes from hierarchy, annotation, and disciplined writing rather than game spectacle.

The player feels that they are submitting a provisional analyst call and receiving the same case back with the decisive reasoning exposed. It is credible enough for pro-CS followers, readable enough for improvement-minded players, and naturally suited to provenance and corrections.

### Centre of gravity

**The quality of the decision workflow.**

This design gives equal weight to state comprehension, the player’s call, and the returned analysis. It is the closest expression of the Phase 1 “analysis desk” promise.

### Visual system

- Primary mode: deep ink canvas with warm off-white text and matte graphite surfaces.
- Light mode: cool bone canvas, near-black ink, quiet graphite rules.
- Attention accent: muted oxide/rust.
- Tactical accent: desaturated steel blue.
- Semantic states: explicit text plus fill/ring/diamond/open-square markers and solid/dashed/dotted lines.
- Surfaces: mostly flat; thin rules; 6–10 px radii; almost no shadow.
- Avoid fake paper, tape, stamps, handwriting, photocopy noise, and page-turn effects.

Typography proposal:

- **DM Sans Variable** for controls, body, navigation, and option labels.
- **Newsreader Variable** sparingly for case leads, debrief section openings, and the transferable principle.
- Tabular numerals from the sans for score, time, money, and edition metadata.
- Sentence case throughout; uppercase reserved for very short metadata only.

Both suggested families have commercially practical open-font routes, but exact licenses and delivery strategy must be rechecked in Phase 3/implementation.

### Layout model

Desktop uses an editorial spread:

- slim folio rail: case number, UTC date, focus, status, and the current stage;
- central reading canvas: objective, state, schematic, current task, or debrief;
- narrow case-notes rail: information legend, glossary, assumptions, selected evidence, or locked line.

Only the current task is visually dominant. The right rail is context, not a dashboard.

Mobile becomes a **Briefing Deck**:

- compact folio header;
- one readable content column;
- full-width evidence and action cards;
- selected evidence summarized above the call;
- sticky bottom action area;
- case notes and glossary in one non-nested disclosure surface.

### Navigation and Today

The global navigation is a quiet three-item bar. Today feels like the cover of the current assignment:

- edition number and explicit UTC date;
- estimated 5–8 minutes;
- broad focus;
- exact status;
- one neutral tension sentence;
- one primary action: Start, Continue, Retry result, View debrief, Review, or Retry later.

No carousel of games, promotional tile wall, activity feed, or pre-completion scoreboard.

### Core game treatment

**Briefing**

The objective comes first, followed by the abstract schematic and a compact fact ledger grouped into Confirmed, Last seen, Inferred, and Unknown. The text representation is a visible alternative surface, not hidden accessibility metadata.

**Read**

Five evidence slips have identical scale and specificity. Tapping the full row toggles selection. A two-slot “What matters” summary and `0/2`, `1/2`, or `2/2` count remain visible. A third choice prompts deselection; it never silently replaces an item.

**Call**

Three to five operational cards appear at the same abstraction level. Selecting an action reveals only its valid qualifiers. Confidence follows as a separate reflective line. Review shows the complete action, qualifier, evidence pair, and confidence before `Lock main call`.

**Follow-up**

New Information arrives as a timestamped editorial dispatch with new, unchanged, and expired facts. Economy/Risk becomes an allocation memo comparing current contest and protected future buy. The main call remains as a locked prior decision.

**Continuation**

The label is explicit: “Here is how the round continued.” A static event summary appears first; Step, Replay, and Show final state are available without forcing animation.

**Debrief**

The result becomes an annotated analyst report in the required order. “Why it works,” “Cost,” “Assumption,” and “Breaks when” appear as clear editorial subheads. The strongest alternative occupies a parallel section rather than an inferior red card. Sources and editorial judgment are visually separated.

### Answer states

- Draft selections use a subtle local-state label.
- Pending commit retains the review summary and says `Submitting…`.
- Acknowledged commit adds a static lock mark and moves focus to the next heading.
- Invalid input identifies the affected group; it never says “wrong answer.”
- Result language uses Best-supported, Equally strong, Defensible, Conditional/high-variance, Weak, or Not feasible.
- Corrected and withdrawn cases retain a sober case-record treatment.

### Results, Cases, and Progress

Results resemble a case mark rather than a rank:

- numeric score;
- Main, Evidence, and Follow-up components with 50/20/30 labels;
- main and follow-up bands;
- confidence separately;
- edition participation;
- debrief completion;
- share, review, and optional practice recommendation.

Cases is a chronological casebook. Progress is a restrained record of participation and sample count before any lens profile appears.

### Motion

- Enter: content rises 8 px with an immediate usable state.
- Select: border, check, and pressed state settle within about 140 ms.
- Lock: a small registration mark appears only after acknowledgement.
- Follow-up: the locked call stays fixed while the dispatch is inserted.
- Reveal: short rules underline each required result section; no delayed text.
- Participation: an edition cell gains a quiet check; no celebration burst.
- Reduced motion: all states appear immediately with heading focus.

### Textual wireframes

Desktop game:

```text
┌────────────┬──────────────────────────────────┬───────────────┐
│ CASE 018   │ Objective                        │ Case notes    │
│ UTC date   │                                  │ Confirmed     │
│            │ Abstract schematic / Text view   │ Last seen 8s │
│ Brief      │                                  │ Inferred      │
│ Read  ●    │ Choose 2 decisive facts          │ Unknown       │
│ Call       │ [Evidence A] [Evidence B]         │               │
│ Follow-up  │ [Evidence C] [Evidence D]         │ Selected 1/2  │
│ Review     │ [Evidence E]                      │ Glossary      │
│            │                         [Continue]│               │
└────────────┴──────────────────────────────────┴───────────────┘
```

Mobile call:

```text
CASE 018 · CALL
Your evidence · 2/2
[Bomb route known] [Last contact 8s old]

What do you do?
( ) Hold and re-clear
( ) Rotate with utility
( ) Commit through the weak side

Execution qualifier
( ) ...

Confidence
[Guessing] [Leaning] [Fairly sure] [Strong read]

[Review call]
```

### Strengths

- Best balance of credibility, clarity, provenance, debrief quality, and rights independence.
- Lowest risk of fake-HUD aesthetics.
- Broadest fit across economy, information, rotation, retake, clutch, and objective cases.
- Strong mobile and accessibility foundation.
- Smallest incremental content-production burden.

### Risks

- Could feel like a magazine or enterprise workflow rather than a game.
- Too much copy could delay the first decision.
- Serif/paper cues could become self-conscious.
- Expert users may find the staged flow slow.

Mitigation: keep the objective and decision-critical summary short, use serif only at editorial moments, preserve a compact Standard mode, and keep the schematic visually central.

---

## 4. Design B — Quiet Signal Instrument

### Positioning

A signal-focused dark instrument for reasoning under incomplete information. The central visual subject is the quality of the signal: confirmed, aging, inferred, or unknown.

This feels most native to active players and most spatially distinctive, while deliberately refusing the visual noise of a broadcast HUD or esports control room.

### Centre of gravity

**The quality of the information read.**

The schematic and signal ledger remain present while the player constructs a call. The debrief becomes a decision trace tied back to visible evidence.

### Visual system

- Primary canvas: charcoal-black mineral plane.
- Elevated surfaces: matte slate.
- Primary text: warm fog/off-white.
- Focus: desaturated cobalt or teal.
- Attention: oxidized copper.
- Uncertainty: open geometry, dash/hatch patterns, age labels.
- Surfaces: planar, 8–12 px radii, precise 1 px borders, restrained shadow.
- Absolutely no glow, scanning grid, crosshair, speedometer, or meaningless telemetry.

Typography proposal:

- **IBM Plex Sans Variable** for UI, headings, choices, and explanation.
- **IBM Plex Mono** only for clock, score, money, age, case ID, and short telemetry.
- Tabular numerals throughout numeric state.
- Large enough labels and sentence case prevent a terminal aesthetic.

### Layout model

Desktop uses a **Command Table**:

- slim truthful state strip across the top;
- central abstract schematic and state canvas;
- right decision rail for evidence, action, or follow-up;
- equally prominent `View as text` control opening the canonical structured state; glossary, rules, and assumptions follow in a separate disclosure.

The interface still has only one dominant task. During Read and Call, the canvas quiets while the decision rail gains emphasis.

Mobile uses a diagram-first surface with one decision sheet:

- state ribbon;
- legible fit-to-view schematic;
- equally prominent explicit zoom controls and `View as text`;
- one bottom-anchored sheet for evidence/action/follow-up;
- no stacked sheets, hidden gestures, or dependence on the schematic for selection.

On compact screens, Text view may be the initial presentation if the schematic cannot remain legible. At 200% zoom, with a resized visual viewport, in forced-colour mode where the overlay loses clarity, or when linear screen-reader navigation is active, the decision surface renders in normal document flow rather than as an overlay sheet. Diagram and text remain synchronized views of one canonical disclosed-state model.

### Navigation and Today

Today is a quiet ready state rather than a cover:

- edition and status in a compact top strip;
- one central case tension;
- broad focus and duration;
- a single Start/Continue action.

Cases uses compact rows with small schematic signatures generated from original abstract geometry. These cannot reveal answers or require copyrighted map art. Progress uses precise edition cells and broad lens bars only when eligible.

### Core game treatment

**Briefing**

The schematic is the primary orientation object. A legend and structured list expose the same facts. Every route, zone, marker, and information-age state maps to real disclosed data.

**Read**

Five signal tiles appear in the decision rail or sheet. Two selected tiles pin into a “Working read” shelf. Visual treatment cannot suggest which signals are preferred.

**Call**

Actions are large operational controls. Qualifiers appear after action selection. The two pinned signals remain visible. Confidence sits in a separate unscored block.

**Follow-up**

One controlled state update marks New, Expired, and Unchanged information. Economy/Risk shows prevalidated packages against Now and Next buy horizons; it never becomes a purchase simulator.

**Continuation**

Player commitment and canonical record occupy visibly separate lanes. The route may trace once, but static event text is immediately available. Step, Pause, Replay, and Show final state remain explicit.

**Debrief**

The decision trace connects each conclusion to the disclosed signal. The player’s evidence pair, strongest alternative, information expiry, and one-variable counterfactual are visually inspectable. The observed professional outcome, if any, remains separate from the tactical grade.

### Answer states

- Draft selections appear as pinned but explicitly local.
- Main acknowledgement adds a precise static lock bar.
- The new stimulus appends to the state rather than replacing history.
- Result pending freezes the accepted decision lane and exposes only Retry result.
- Bands use words and shapes, never green/red correctness.

### Results, Cases, and Progress

The result uses three precisely labelled component bars with their exact points and weights, plus main/follow-up band language and separate confidence. It must not resemble a speedometer, percentile, ELO, or simulated performance score.

Cases can filter by focus and information tension. Progress may later reveal overlooked information-age patterns, but only after thresholds and without claiming actual match skill.

### Motion

- Enter: one short route line draws while the interface is already usable.
- Select: a signal tile pins within about 140 ms.
- Lock: a vertical lock bar appears after acknowledgement.
- Follow-up: one new fact enters; age changes become static label changes, never pulses.
- Reveal: component bars settle once; accepted alternatives appear as parallel lanes.
- Reduced motion: static schematic, immediate lock, appended text row, static event list.

### Textual wireframes

Desktop game:

```text
┌──────────────────────────────────────────────────────────────┐
│ R12 · 00:31 FROZEN · 3v3 · Bomb known · Utility 3/2         │
├──────────────────────────────────────────┬───────────────────┤
│                                          │ READ · choose 2   │
│          ABSTRACT ZONE MAP               │ [Signal A]        │
│     ○ A ─── 6s route → □ B               │ [Signal B]        │
│       △ last seen 8s   ● teammate        │ [Signal C]        │
│                                          │ [Signal D]        │
│ [−] [Fit] [+] [View as text]             │ [Signal E]        │
│                                          │ Working read 1/2  │
│                                          │        [Continue] │
├──────────────────────────────────────────┴───────────────────┤
│ Glossary · Assumptions · Structured state                    │
└──────────────────────────────────────────────────────────────┘
```

Mobile follow-up:

```text
MAIN CALL LOCKED
[Rotate with utility · late contact]

NEW INFORMATION · 00:23
New       A-site contact confirmed
Expired   Mid last seen · now 16s old
Unchanged Bomb location unknown

( ) Keep original
( ) Change to [finite line]
( ) Change to [finite line]

[Lock follow-up]
```

### Strengths

- Strongest distinctive CS identity without licensed game media.
- Best expression of incomplete information and information age.
- Most compelling desktop spatial experience.
- Particularly strong for rotations, stale information, post-plants, map control, and adaptation.

### Risks

- Highest risk of fake-HUD drift, decorative data, or excessive darkness.
- Highest schematic, mobile, low-vision, and screen-reader burden.
- Can feel technical or exclusionary to the secondary audience.
- Economy and objective trade-offs may become secondary to “spot the signal.”

Mitigation: ban non-functional telemetry, make plain-language text co-equal, default compact phones to the most legible view, and test diagram/text parity as a content acceptance criterion.

---

## 5. Design C — Round Review Filmstrip

### Positioning

A modern after-action review lane. The player locks a line, advances through the independently authored round record, and then compares their reasoning with accepted alternatives and one principle worth carrying into the next match.

It feels less like an editorial case file and more like a controlled replay/review studio: chronological, visual, and explicit about the boundary between what the player chose and what the authored round did.

### Centre of gravity

**The quality of the after-action learning loop.**

The pre-commit flow is calm and sequential. After both locks, the same case transforms into a review timeline. The emotional reward is the explanation, counterfactual, and transferable principle.

### Visual system

- Primary dark mode: cool blue-black canvas with pale neutral modules.
- Light mode: cool ash canvas, white modules, near-black text.
- Directional accent: restrained cobalt.
- Counterfactual/attention accent: muted coral, never used alone for correctness.
- Secondary signal: deep teal.
- Geometry: vertical event spine, hard alignment lines, compact 4–6 px radii, parallel player/canonical lanes, and bold but sparse dividers.
- No paper texture, editorial folios, serif-led case sheets, scrapbook props, stickers, stamps, camouflage, or handwriting.

Typography proposal:

- **Manrope Variable** for controls, body, headings, results, and the final principle.
- **IBM Plex Mono** only for timestamps, money, and frozen telemetry.
- No serif family; hierarchy comes from scale, weight, alignment, and the event spine. This deliberately separates the system from Design A's editorial voice.
- Body remains at least 16/24 with generous line length and spacing.

### Layout model

Desktop uses a **Round Filmstrip** after commitment:

- slim phase index;
- central current case card or review beat;
- separate side lane for the locked player line, glossary, and source status.

Before commitment, the future filmstrip does not exist in the client. After commitment, player line and canonical continuation use separate lanes. Advancing a beat changes presentation position only; it never changes the authored round or official answer.

Mobile uses a vertical **Decision Ladder**:

- one primary card per checkpoint;
- compact stage index: Brief, Read, Call, Follow-up, Review;
- explicit Previous/Continue buttons, never swipe-only;
- prior disclosed states reopen as read-only after server acknowledgement; an acknowledged answer can never become editable;
- fixed safe-area action bar;
- after commitment, normally three player-advanced presentation beats followed by review sections; a case may use two to five only when each beat is necessary and the 5–8 minute session/debrief target remains credible.

### Navigation and Today

Today is minimal and promise-led:

- edition/date, focus, duration, status;
- one line: “Make the call, then review the evidence.”
- one primary action.

Cases is a review-oriented history: Review, Finish debrief, or Practice. Progress emphasizes participation and, later, recurring principles or broad lenses—not courses, levels, or a second learning product.

### Core game treatment

**Briefing**

Three clear groups—Situation, Signals, Constraints—make all disclosed information available without forcing simultaneous density. Open full state and the schematic/text toggle are always available.

**Read**

Five full-width evidence cards appear together in a vertical list. The selected pair forms a visible “What matters” row. Cards remain comparable and do not become a carousel.

**Call**

The interaction is deliberately checkpointed: action, qualifier, confidence, then review. This lowers mobile cognitive load but must be kept brisk in Standard mode.

**Follow-up**

New Information is a before/now/expired comparison. Economy/Risk is a Now/Next-horizon comparison. The locked original line remains visible.

**Continuation**

The introduction says, “Here is how the authored round continued.” Presentation beats are advanced by the player; Show final state is always available. Advancing changes playback position only, not the authored record. No outcome appears before the follow-up commit.

**Debrief**

The player’s line becomes one fixed comparison lane beside the canonical round record. The required reveal order remains intact, but the review emphasizes:

- why the line works;
- its cost and assumption;
- what breaks it;
- the strongest alternative;
- the decisive information used or missed;
- the one-variable counterfactual;
- the final transferable principle.

Reaching the principle marks `debrief_complete` through an explicit Continue/Complete review action, not passive scroll detection.

### Answer states

- Each checkpoint keeps a concise summary of prior selections.
- Local draft and official lock status are written plainly.
- Commit pending disables branch changes without erasing the review summary.
- The result initially gives the complete numeric and band summary; later review cards cannot delay access to it.
- The player may jump among already revealed review sections.

### Results, Cases, and Progress

The final result is a case record:

- total and three components;
- main and follow-up bands;
- confidence;
- “What to carry forward” principle;
- participation and debrief completion;
- optional practice recommendation;
- spoiler-free share.

Cases prioritizes unfinished debriefs and reviewable completed cases. Progress may later group recurring principles, but only where the content taxonomy and sample size support it.

### Motion

- Enter: the current card settles 8 px; no carousel or page flip.
- Select: a static annotation bracket and check appear.
- Lock: the submitted line gains a registration mark after acknowledgement.
- Follow-up: the original line stays while a field note appears.
- Continuation: explicit step-based crossfades; no autoplay requirement.
- Counterfactual: one-variable before/after crossfade.
- Principle: brief underline or focus shift, not confetti.
- Reduced motion: immediate cards, static ordered event list, instant disclosures.

### Textual wireframes

Mobile briefing:

```text
CASE 018 · BRIEFING
Objective: Preserve the round while securing the site.
Estimated time: 5–8 min

SITUATION
Round · clock · bomb · manpower

SIGNALS
Confirmed · Last seen · Inferred · Unknown

CONSTRAINTS
Economy · utility · routes · assumptions

[View schematic] [Glossary] [Neutral cue]
[Continue to evidence]
```

Mobile review:

```text
YOUR LINE
Rotate with utility · late contact
Evidence: A and B · Confidence: Leaning

RESULT
Defensible · Follow-up: Best-supported
74 / 100
Main 39/50 · Evidence 15/20 · Follow-up 20/30

WHY IT WORKS
[review text]

[Next: Cost and assumption]
```

Desktop post-commit:

```text
┌───────────┬────────────────────────────────┬──────────────────┐
│ Review    │ HOW THE ROUND CONTINUED        │ Your locked line │
│ Result ●  │ Beat 1 · 00:23                 │ Action           │
│ Why       │ Beat 2 · 00:17                 │ Qualifier        │
│ Cost      │ Beat 3 · 00:09                 │ Evidence A and B │
│ Alt line  │                                │ Confidence       │
│ Principle │ [Step] [Replay] [Final state]  │                  │
└───────────┴────────────────────────────────┴──────────────────┘
```

### Strengths

- Strongest debrief continuity and learning transfer.
- Best fit for the promise “See what you missed.”
- Natural later home for rights-cleared professional reconstructions.
- Most empathetic treatment of defensible minority lines.
- Strong mobile checkpoint model.

### Risks

- Can feel like a lesson, onboarding sequence, or card quiz.
- Highest editorial burden if every review beat and counterfactual must be excellent.
- Users may leave after seeing the score and never reach the principle.
- A timeline may imply that the player caused the canonical outcome.
- Too much sequencing may frustrate expert users.

Mitigation: show the full result immediately, allow jumps among revealed review sections, explicitly separate player line and canonical record, keep Standard mode concise, and measure `debrief_complete` independently. During the content simulation, record the incremental authoring/review time for every continuation beat; reject or simplify this design if it prevents mature synthetic cases from meeting the Phase 1 approximately 6–7 hour expectation or the weekly buffer gate.

---

## 6. Direct comparison

| Dimension | A. Editorial Tactical Desk | B. Quiet Signal Instrument | C. Round Review Filmstrip |
|---|---|---|---|
| Primary mental model | Expert case file | Signal-focused instrument | Replay and comparison lane |
| Product centre | Decision workflow | Information quality | Learning/debrief |
| Strongest audience fit | Balanced primary + secondary | Experienced active players | Improvement-minded + pro-story followers |
| Mobile model | Briefing Deck | Diagram + one decision sheet | Decision Ladder |
| Desktop model | Editorial spread | Command Table | Decision/review filmstrip |
| Schematic role | Important, not dominant | Primary orientation object | Supporting before commit; explanatory after |
| Debrief role | Analyst report | Decision trace | Signature reward |
| Hypothesized tactical identity | High and restrained | Potentially highest if disciplined | High through review language |
| Accessibility risk | Lowest | Highest | Medium |
| Content overhead | Lowest incremental | Medium | Highest |
| Visual cliché risk | Magazine/SaaS | Fake HUD | Flashcards/coaching app |
| Best case families | Broadest range | Information, rotation, map control | Adaptation, clutches, pro reconstructions |
| Long-term extensibility | Strong | Strong but schematic-heavy | Strong if editorial capacity exists |

### Weighted selection framework

| Criterion | Weight |
|---|---:|
| Decision legibility and fair state comprehension | 25% |
| Debrief comprehension and principle recall | 20% |
| Mobile completion and recovery quality | 15% |
| Credibility with active CS followers | 15% |
| Repeatability across at least 60 cases | 10% |
| Distinct tactical identity without visual clichés | 10% |
| Operational simplicity and rendering/content overhead | 5% |

Rights and asset independence are pass/fail requirements shared by every design, not a differentiator. The audience-fit, accessibility-risk, content-overhead, identity, and extensibility entries above are design hypotheses, not measured findings. No design should ultimately win through stakeholder taste alone. Equal-content prototypes must use the same case, copy, actions, rubric, and answer options.

---

## 7. Pre-prototype orchestrator recommendation

This is the Phase 2 recommendation required for user selection. It is a requirements-based judgment from the PRD and independent specialist reviews—not evidence from users, a working prototype, measured production cost, or accessibility testing. The validation plan may overturn it.

### Recommended foundation: Design A — Editorial Tactical Desk

Design A is the provisional best fit because it serves the selected audience without overcommitting the product to a diagram-heavy interface or a coaching-first identity before either has been validated.

It makes the deep case credible, gives the debrief adequate editorial gravity, and supports provenance and corrections. It also provisionally appears to carry the lowest mobile/accessibility and incremental content-production risk. It leaves room to borrow two particularly strong ideas from the challengers without dissolving into an aesthetic hybrid:

- from Design B: the precise signal grammar for Confirmed, Last seen, Inferred, and Unknown;
- from Design C: the explicit player-line versus canonical-record separation and the final transferable-principle moment.

This is not a recommendation to average the three aesthetics. The layout, typography, pacing, and core mental model should remain Design A.

### Learning-first challenger: Design C — Round Review Filmstrip

Design C is the most strategically interesting challenger because the Phase 1 thesis says the explanation must be valuable enough to become the reward. It should win if testing shows materially stronger debrief completion, principle recall, and return intent without pushing sessions beyond the 5–8 minute target or making experienced players feel taught at.

### Spatial-first challenger: Design B — Quiet Signal Instrument

Design B has the strongest immediate Counter-Strike identity and may appeal most to the primary player/follower audience. It should win only if it materially improves tactical-state comprehension and repeat interest while passing diagram/text parity, mobile completion, and anti-HUD reviews. It carries the highest execution risk.

---

## 8. Prototype and validation plan after selection

Phase 2 stops for design selection before code. Once selected, the design definition should be completed using one identical representative synthetic case and these artefacts:

1. Mobile Today, Briefing, Read, Call, Follow-up, Result, Debrief, Cases, and Progress screens.
2. Desktop equivalents for Today, game state, and debrief.
3. Diagram and text-equivalent state specification.
4. Component state matrix for default, focus, selected, disabled, pending, locked, error, corrected, and withdrawn.
5. Motion storyboard plus reduced-motion equivalents.
6. Content-length stress cases and 320 px/200% reflow layouts.
7. Keyboard and screen-reader reading/focus order.
8. Spoiler-safe share-text examples.

Test with identical content across any remaining finalists:

- Can users identify the objective and distinguish confirmed, last-seen, inferred, and unknown information?
- Can they complete the entire case on a phone without zoom, drag, overflow, or accidental submission?
- Do they understand that the canonical continuation is independent of their call?
- Can at least 80% of moderated debrief participants explain their band, cost, and breaking condition?
- Among at least 30 follow-up participants in formative testing, can at least 60% state the transferable principle accurately after 24 hours? Report numerator, denominator, and 95% confidence interval; treat this as directional until a powered study is designed.
- Do active players describe the product as tactical judgment rather than a quiz, dashboard, or lesson?
- Does at least 65% of `decision_complete` attempts reach `debrief_complete`, matching the Phase 1 retention gate definition?

Required accessibility validation:

- text-only completion;
- keyboard-only completion;
- VoiceOver/Safari on iPhone;
- TalkBack/Chrome on Android;
- NVDA/Firefox on Windows;
- 320 CSS px, 200% zoom/reflow, forced colours/high contrast, and reduced motion;
- offline draft, pending result, lost-response retry, reset during play, revision conflict, correction, withdrawal, and local-progress failure;
- no pre-commit leak through visible UI, DOM, accessibility labels, metadata, cache, prefetch, or serialized state.

---

## 9. Decision required

Choose one design to carry into detailed design definition:

- **A — Editorial Tactical Desk:** recommended balanced foundation.
- **B — Quiet Signal Instrument:** most spatial and CS-native, with the highest execution risk.
- **C — Round Review Filmstrip:** strongest learning and debrief identity, with the highest editorial burden.

The choice locks the dominant mental model and layout system. Small proven interaction details may still be borrowed from another design, but Phase 3 must not become an undifferentiated blend.

---

## 10. Phase boundary

No repository, production code, final name, Cloudflare architecture, or production asset system is authorized by this document.

After the user selects a design, the next task is to finalize its screen-level design specification and obtain approval. Only then should Phase 3 research current Cloudflare guidance and define the technical architecture.
