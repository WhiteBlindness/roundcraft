# CS2 Daily Games Platform — Phase 1 Product Requirements Document

**Status:** Proposed for user approval  
**Date:** 29 August 2026  
**Selected direction:** Direction C, game-sense-first  
**Working format name:** Daily Round Review (not a product-name decision)  
**Document scope:** Product definition only. No repository, production code, final visual design, or Cloudflare architecture is authorized by this document.

---

## 1. Executive decision

Build one shared Counter-Strike case that asks the player to read a round, make a defensible call, respond to new information, and understand the decisive evidence afterward.

The product promise is:

> **Read the round. Make the call. See what you missed.**

Direction C is the launch position. Direction D—the broader CS daily puzzle arcade—is retained as an expansion strategy and interaction vocabulary, not a second MVP. Familiar puzzle mechanics may appear as one embedded follow-up inside the case. They do not become separate top-level games until the flagship has independently demonstrated retention and sustainable content production.

The core audience is deliberately focused:

- Primary: active Counter-Strike players who also follow professional CS.
- Secondary: active players who want to improve their round-reading and decisions.
- Acquisition audience: pro-scene followers who enjoy important matches and tactical stories, even if they play less often.

The product should be accessible to a competent player without becoming beginner trivia. Guided terminology and progressive disclosure broaden comprehension; they do not flatten the tactical problem.

### Product thesis

Most existing CS browser games test recall or visual recognition. This product tests judgment under incomplete information. Its durable advantage should be the quality of its cases, the fairness of its multiple-answer rubrics, and the usefulness of its debriefs—not ownership of a familiar puzzle mechanic.

### Critical constraint

Granular professional-round data is not a dependable free foundation. The platform must remain source-agnostic:

1. Start with original, constraint-driven synthetic cases.
2. Test professional reconstructions only with documented access and usage rights.
3. Use official factual sources and open structured data for context.
4. Never make publishing or scoring depend on scraped sites, copied media, or a free AI quota.
5. Pivot the publishing mix if licensing or editorial throughput fails its explicit gates.

### MVP in one sentence

An untimed, no-login analysis-desk case with one main tactical call, exactly two evidence selections, one follow-up decision, deterministic server-authoritative scoring, several accepted lines, and a reviewed, provenance-labeled debrief. Beta targets a 5–8 minute median and validates that target rather than treating it as fact.

---

## 2. Goals, non-goals, and product principles

### Goals

- Give active players a credible test of Counter-Strike understanding in under ten minutes.
- Make the explanation valuable enough that completing the debrief feels like the reward.
- Judge defensible minority answers fairly and transparently.
- Create a shared daily object that prompts teammate discussion without revealing answers through sharing.
- Establish a sustainable, legally usable content pipeline before promising a public daily cadence.
- Preserve a clear path from synthetic cases to licensed professional reconstructions.
- Keep free daily play as the acquisition and retention core while leaving monetizable depth for later.

### Non-goals for MVP

- A broad arcade of separate minigames.
- A Counter-Strike Wordle, player guesser, skin guesser, or basic stat comparator.
- A professional demo-analysis suite.
- Aim training or mechanical execution training.
- A perfectly realistic branching match simulator.
- An AI referee that invents the official score.
- A global leaderboard, ELO, prizes, or response-time competition.
- Mandatory login, social graph, or cross-device sync.
- Live professional statistics or automatic daily demo ingestion.
- Team logos, player photos, broadcast clips, game audio, Valve radar images, or extracted weapon assets in the core experience.

### Product principles

1. **One shared object.** Everyone receives the same case edition.
2. **Judgment, not author mind-reading.** Players may only be assessed on disclosed information.
3. **Trade-offs over false certainty.** A non-leading line can still be strong or defensible.
4. **Outcome is not optimality.** What a professional team did is not proof that it was the best call.
5. **Explanation is gameplay.** The debrief is a required product surface, not an appendix.
6. **Official results are reproducible.** Versioned human-authored rubrics determine scores.
7. **Tactical depth, simple interaction.** The state may be nuanced; the interface should remain focused.
8. **No login to play.** Accounts must earn their place later.
9. **Rights before scale.** Public visibility is not permission to scrape, store, transform, or monetize.
10. **Quality before cadence.** Reduce frequency before publishing weak or unfair cases.

---

## 3. Audience and jobs to be done

### Primary persona — active CS follower

Typical behavior:

- Plays Premier, FACEIT, or organized matches regularly.
- Watches Majors and some tier-one professional CS.
- Understands common economy, utility, role, and map-control language.
- Wants a short, credible challenge rather than a lesson plan.
- Enjoys debating decisions with friends or teammates.

Core job:

> Give me a short CS situation that tests whether I actually understand the round.

### Secondary persona — improvement-minded active player

Typical behavior:

- Plays actively but is inconsistent in rotations, economy, retakes, or mid-round decisions.
- Wants practical explanations rather than long videos.
- Benefits from a glossary, guided context, and broad progress categories.

Core job:

> Help me recognize what matters and make better decisions in my own matches.

### Acquisition persona — pro-scene enthusiast

Typical behavior:

- Knows teams, players, events, and major moments.
- Is attracted by professional context and “what happened next.”
- May be less comfortable with advanced tactical state.

This audience may help discovery, but it does not dictate the MVP rules. Professional context enriches the flagship case rather than becoming an unrelated trivia feed.

### Explicit non-targets

- People with no meaningful Counter-Strike knowledge.
- Elite analysts seeking a professional-grade review platform.
- Players primarily seeking aim or movement drills.
- General puzzle users with no interest in CS.

### Functional, emotional, and social jobs

| Type | Job |
|---|---|
| Functional | Test round-reading and decision quality in a provisional 5–8 minute session |
| Functional | Learn why a call works, fails, or becomes conditional |
| Functional | Compare reasoning with an expert-reviewed rubric and aggregate answer distribution |
| Functional | Revisit released cases in weak areas |
| Emotional | Feel clever for identifying a decisive constraint |
| Emotional | Feel fairly treated when choosing a minority line |
| Emotional | Leave with one memorable principle rather than only a number |
| Social | Share a spoiler-free result |
| Social | Debate the call with teammates without requiring a public leaderboard |

---

## 4. Product structure and navigation

MVP navigation should contain only:

- **Today** — the current shared case and its completion state.
- **Cases** — released archive and practice.
- **Progress** — participation and, after enough data, broad knowledge patterns.

Do not create top-level Arcade, IQ, Pro, Dashboard, Community, or Leaderboard sections in MVP.

Professional context appears within the case debrief and as a filter in Cases when enough rights-cleared inventory exists. Direction D-style mechanics may appear within the follow-up step. If a mechanic later demonstrates independent demand, it may graduate to a weekend experiment in V1.1.

---

## 5. The flagship game: Daily Round Review

### 5.1 Core format

Use an **analysis-desk timeline**, not a branching simulator.

Each case has an immutable authored or documented continuation. The player chooses what they would do, but the canonical round proceeds independently. Transition copy must say “Here is how the round continued,” not imply that the user caused the next state.

This design:

- avoids exponential branch authoring;
- fits professional rounds later;
- keeps scoring deterministic;
- avoids invented probabilities;
- supports counterfactual teaching;
- keeps one case producible in hours rather than days.

### 5.2 Session shape

Provisional target median: 5–8 minutes. No response timer. Measure decision time and debrief time separately; target approximately 3–4 minutes before reveal and 2–4 minutes in the debrief.

1. **Briefing** — inspect the legitimate round state.
2. **Read** — select exactly two decisive facts from exactly five case-authored choices.
3. **Call** — choose one of 3–5 operational calls, exactly one of 2–4 case-authored execution qualifiers, and one confidence label.
4. **Commit** — confirm an immutable official answer.
5. **Follow-up stimulus** — receive only the new information required for the selected follow-up.
6. **Follow-up** — exactly one New Information or Economy/Risk interaction, then commit it.
7. **Canonical continuation** — see how the authored or documented round progressed after all scored inputs are locked.
8. **Debrief** — evaluation, alternatives, decisive evidence, counterfactual, transferable principle, and sources.
9. **Result** — component result, participation, optional share, and optional practice recommendation.

### 5.3 Information model

Every piece of tactical information must be classified as:

- **Confirmed** — currently verified.
- **Last seen** — timestamped and becoming stale.
- **Inferred** — a supported reading, not a fact.
- **Unknown** — deliberately unavailable.

The briefing may include:

- side, score, round, and declared decision objective;
- alive players and health;
- equipment, armor, kits, and utility;
- team economy and relevant round horizon;
- clock and bomb state;
- map zones, route relations, and case-supplied travel times;
- confirmed, stale, inferred, and unknown opponent information;
- environment assumption: coordinated team, professional round, or ranked play;
- game build/ruleset and map version.

No scoring decision may use hidden enemy state or eventual outcome.

### 5.4 Input and answer contract

The MVP main decision contains:

- exactly one primary action ID from 3–5 case-authored options;
- exactly one execution-qualifier ID from 2–4 options valid for the selected action;
- exactly two distinct decisive-fact/reason IDs from exactly five choices;
- exactly one confidence label: Guessing, Leaning, Fairly sure, or Strong read;
- optional structured report category: `missing_action`, `missing_qualifier`, `missing_evidence`, `incorrect_disclosed_fact`, or `other`.

The required answer and report are structured and touch-friendly. MVP has no free-text input.

Each case offers 3–5 operationally distinct calls at the same abstraction level. Options must not be synonyms, one detailed line among vague labels, or a hidden test of wording.

### 5.5 Follow-up modules

Every MVP case declares exactly one `follow_up_type` from this closed enum:

| Module | Player task | Best use |
|---|---|---|
| New information | Keep, revise, or replace the call | Information expiry, rotations, anchors |
| Economy and risk | Choose a coordinated posture or allocation | Buy/save, match horizon, retake/save |

Chronology, forensic evidence, prediction, “what happened next,” and explicit decision-boundary modules move to V1.1 experiments. This scope lock applies to the first public 30-day calendar as well as beta.

### 5.6 Hints and explanation depth

The same daily case is served to everyone. There are no beginner and expert editions.

- **Guided:** terminology, expanded context, and neutral prompts.
- **Standard:** concise CS-native language.

Interface and terminology help are always free. One optional coach cue may highlight a relevant dimension without naming the preferred line. Assisted completion still counts for participation. If answer distributions are later segmented, assisted attempts are separated rather than penalized.

Every authored hint has a `hint_id`, allowed tactical-dimension ID, text, and `assisted=true` effect. It may not contain an action ID, action label, rubric band, or answer-dependent wording.

### 5.7 Failure and non-success states

There is no gameplay elimination. A weak call still receives the full debrief.

Handled states include:

- missing required selection;
- invalid or expired case/rubric revision;
- pending submission;
- duplicate or concurrent submission;
- offline draft awaiting connection; no official commit, participation, score, or reveal occurs until server acknowledgement;
- withdrawn or corrected case;
- result temporarily unavailable;
- local progress unavailable.

A network or provider failure cannot consume the official attempt. The product must never invent a local “official” score during an outage.

### 5.8 Reveal requirements

For the player's line, show in this order:

1. Main-call band.
2. Follow-up band.
3. Composite score and its 50/20/30 component values; evidence contributes points but has no separate band.
4. Why the line works.
5. Its principal cost or danger.
6. The assumption it relies on.
7. The condition that breaks it.
8. The strongest alternative and why it also works.
9. The decisive information used or missed.
10. One single-variable counterfactual.
11. One transferable CS principle.
12. For a real case: observed professional line, actual outcome, limitations, and sources.

Never imply access to team communications unless a sourced interview or authorized material provides it. Do not invent win percentages.

Every original case and debrief is visibly labeled **“Synthetic scenario — editorial tactical analysis.”** Its sourced rules/mechanical facts are listed separately from reviewer judgment, accepted lines, and authored counterfactual interpretation. A professional case is instead labeled with its event, ruleset, provenance, rights-cleared identity fields, and the limits of what the source can establish.

### 5.9 Daily and practice behavior

- One official result per anonymous identity and case edition.
- Main call becomes immutable after explicit confirmation.
- Follow-up becomes immutable after its confirmation.
- Retrying the same request returns the same state/result.
- Practice is available after completion and never overwrites the official result.
- Missed released cases may be played later as practice; they do not repair a daily streak retroactively.
- Archive cases retain their historical ruleset and rubric revision.
- Player distributions appear only after completion and never redefine correctness.
- No response-time score.

### 5.10 Edge cases

- A missing fact that can reverse the preferred line invalidates the case.
- Role-specific variants with the same tactical intent are aliases.
- Equivalent partial chronologies receive equal credit.
- Hidden enemy state cannot be used retrospectively.
- A successful professional outcome does not prove decision quality.
- A case with irreducible expert disagreement becomes an unscored Debatable Call or is rejected; it cannot be the official daily.
- A materially flawed published case preserves participation and voids affected comparative scoring.
- A reset during play does not silently swap the active edition.

### 5.11 MVP mechanic contracts

Daily Round Review is the only MVP game. It composes one mandatory tactical-decision node with exactly one New Information or Economy/Risk follow-up. “RoundIQ” remains a descriptive working label, not a decided product or mode name.

#### Mandatory RoundIQ node

| Requirement | Contract |
|---|---|
| Rules | Choose a best-supported operational call using only disclosed information and the declared environment/objective |
| Input | Abstract schematic plus equivalent text; score, clock, bomb, manpower, health, equipment, utility, economy, information age, route relations, ruleset |
| Answer | Exactly one call ID, one valid qualifier ID, two evidence IDs, and one confidence label |
| Scoring | Human-authored action matrix and dimension rubric; several calls may occupy the top band |
| Hints | Terminology and neutral coach cue; never the preferred action |
| Reveal | Works/cost/assumption/breaking condition/alternative/decisive evidence/counterfactual/principle |
| Daily | One immutable official commit; no timer |
| Practice | Same rubric; retries labeled practice and never overwrite official result |
| Key edge | Missing reversible fact invalidates the case; pro outcome cannot determine grade |
| Data | Player-visible state, legal actions, qualifier/reason ontology, rubric profiles, caps, counterfactual, reviewers, patch/source/rights metadata |

#### New Information follow-up

| Requirement | Contract |
|---|---|
| Rules | Respond to one case-authored stimulus that changes or ages the disclosed state; the original call is already locked |
| Input | Stimulus ID and timestamp; facts classified as confirmed, last seen with age, inferred with provenance, or unknown; any expired earlier fact is identified |
| Answer | Exactly `keep_original` or `change_to(action_id, qualifier_id)` from a finite case-authored response set; no free text and no arbitrary action construction |
| Scoring | Every valid response ID has an authored integer `F` from 0–100 in the versioned matrix; invalid response IDs or action/qualifier pairs are rejected before commit; no runtime qualitative judgment |
| Hints | Terminology and a neutral information-age cue; never names a preferred response |
| Reveal | Why keeping/changing works, what new fact matters, cost of delay, strongest alternative, and the condition that would reverse the recommendation |
| Key edge | Stimulus cannot disclose the canonical outcome; keep and change may both be top-band; a change must use a currently legal action + qualifier pair |
| Data | Stimulus/revision/timestamp, changed and expired fact IDs, finite response IDs, `F` matrix, explanation fragments, counterfactual, and accessibility text |

#### Economy and Risk follow-up

| Requirement | Contract |
|---|---|
| Rules | Choose a coordinated team posture across the relevant round horizon, not merely an individual weapon purchase |
| Input | Team money, saved equipment, loss-income state, score/remaining rounds, opponent economy classified as confirmed, last seen, inferred with age/provenance, or unknown; versioned prices; prevalidated purchase packages |
| Answer | Exactly one posture/package ID and one valid allocation-priority ID |
| Scoring | Every valid posture + allocation-priority pair has an authored integer `F` from 0–100 in the versioned matrix; invalid or unaffordable pairs are rejected before commit; no runtime qualitative judgment; current contest and protected future buy may both be top-band |
| Hints | Exact package contents and rules glossary; optional cue may highlight match horizon |
| Reveal | Present firepower, utility/trade structure, loss consequence, alternative condition, one-variable flip point; qualitative unless sourced simulation exists |
| Key edge | Every package must be affordable; last-regulation/overtime rules explicit; no assumption that weapons survive |
| Data | Versioned prices/income, inventory/package totals, current/future reserves, match horizon, opponent-information class/age/provenance, exact affordability invariants, and `F` matrix |

#### V1.1 candidate — Evidence and Chronology follow-up

| Requirement | Contract |
|---|---|
| Rules | Reconstruct only mandatory causal/temporal constraints; do not demand a total order when events are interchangeable |
| Input | Three to six event/evidence cards, timestamps/rounding policy, bomb/utility observations, confirmed/stale zones, case-supplied travel constraints |
| Answer | Partial order, simultaneous group, required predecessor, impossible sequence, decisive clue, or supported inference |
| Scoring | Independent pairwise constraints and causal inferences; all accepted topological orders score identically |
| Hints | Rules/notation help; optional assisted clue may expose one constraint |
| Reveal | Step-through valid partial order, mandatory dependencies, unconstrained events, and causal clue |
| Key edge | No false order from timestamp rounding; constraint graph must be solvable and acyclic unless finding the contradiction is the task |
| Data | Event IDs, display times and precision, constraint graph, interchangeable groups, travel-time bounds, accepted inferences, contradiction set |

Evidence/Chronology is fully deferred from MVP. Its contract is retained to define the next embedded-puzzle experiment, but it is not present in beta, the first public 30 days, or the MVP score.

The general daily/practice, accessibility, touch, keyboard, failure, persistence, and correction requirements in Sections 5, 7, and 8 apply to every shipped contract.

### 5.12 Stage-specific data exposure

| Stage | Server may disclose | Server must withhold |
|---|---|---|
| Before main commit | Current player-visible state, option/qualifier/reason labels, neutral hints, public case metadata | Rubric values/bands, accepted paths, counterfactual, follow-up stimulus, canonical outcome, debrief, future cases |
| After main commit | Only the follow-up stimulus and choices required for this attempt | Main/follow-up scoring, later canonical outcome, debrief, hidden alternatives, future cases |
| After follow-up commit | Canonical continuation, versioned score components, debrief, accepted alternatives, counterfactual, eligible distribution, sources | Unreleased case inventory and editorial-only notes |

An API error must not reveal which invalid guess was “closer” to an accepted answer.

Withheld fields must not appear in initial HTML, serialized application state, JavaScript bundles, source maps, service-worker caches, CDN prefetches, page metadata, predictable asset URLs, or archive endpoints. A later automated serialized-payload test must scan every pre-commit delivery surface for forbidden rubric, continuation, and future-case fields.

---

## 6. Deterministic grading and multiple defensible answers

### 6.1 Official score

The official daily score is out of 100:

| Component | Weight |
|---|---:|
| Main call and execution | 50 |
| Use of available evidence | 20 |
| Follow-up decision or reconstruction | 30 |

Confidence is a separate long-term calibration measure. It does not change the daily total or streak.

### 6.2 Tactical rubric

Every valid **action + qualifier pair** receives a human-authored 0–4 rating on all dimensions defined by its scenario-family template:

- objective value;
- use of information;
- timing and physical feasibility;
- coordination and tradeability;
- economy and future-round value;
- utility/resource efficiency;
- robustness and risk calibration.

For a general RoundIQ decision, the normalized internal weighting is:

| Dimension | Weight |
|---|---:|
| Objective | 25 |
| Information | 20 |
| Timing | 15 |
| Coordination | 15 |
| Economy | 10 |
| Risk | 10 |
| Resources | 5 |

The action-quality value is:

\[
Q(a)=\sum_i w_i\frac{r_{a,i}}{4}
\]

Scenario-family templates may change the internal dimension emphasis, but every shipped template must define every dimension it uses and its weights must sum to exactly 100. A case cannot omit a dimension at runtime.

Hard caps apply to \(Q\) before component scaling and rounding. When several apply, the lowest cap wins:

- physically impossible or illegal call: maximum action quality 20;
- relies on information explicitly contradicted by the case: maximum 35;
- requires an unstated favorable assumption: maximum 55;
- otherwise no cap.

The published score is calculated deterministically:

\[
S=\operatorname{round}(0.50Q+E+0.30F)
\]

Where:

- \(Q\) is the 0–100 authored quality value for the whitelisted action + qualifier pair, after hard caps;
- \(E\) is a versioned integer from 0–20 looked up by the committed action and the unordered pair of exactly two distinct evidence IDs;
- \(F\) is a versioned 0–100 value looked up by the follow-up response: one finite `keep_original` or `change_to(action_id, qualifier_id)` response for New Information, or one whitelisted posture + priority pair for Economy/Risk.

Each case exposes exactly five evidence IDs, so all ten unordered pairs of two distinct IDs are valid for every action. The author therefore supplies 30–50 `E` cells for the case's 3–5 actions; evidence scoring does not multiply by qualifiers. Unknown IDs and selecting the same ID twice are invalid, but the UI must not let a player form an invalid visible pair. This bounded matrix is part of the measured case-production budget.

Rounding is to the nearest integer, with exact .5 values rounded upward. Invalid action/qualifier or follow-up combinations are rejected before commit and never coerced into a score. Contradictory evidence pairs may receive a low authored `E` value but cannot be rejected or earn additive keyword credit. The confidence label and structured report category do not enter the formula.

Optional prose and AI availability do not affect the MVP score.

### 6.3 Outcome language

Action and follow-up rubric bands use these fixed version-1 ranges:

| Band | Authored value |
|---|---:|
| Best-supported | 90–100 |
| Equally strong | 90–100, marked by shared consensus rather than a lower score |
| Defensible | 70–89 |
| Conditional / high-variance | 50–69 |
| Weak | 21–49 |
| Not feasible | 0–20 |

Use “correct” and “incorrect” only for objective contradictions such as impossible timing, invalid economy, or impossible chronology.

The result screen shows the numeric total and three components, but no generic overall rank. Tactical labels attach to the call and follow-up values. `score=null` is used for an unscored non-official case. No competitive rank is created.

### 6.4 Dominance rule

A tactical line is called wrong only when it is:

- impossible;
- based on false disclosed information;
- incompatible with the declared objective; or
- dominated by another line across the case's finite, reviewer-approved set of admissible states.

Each case explicitly enumerates only the hidden-variable ranges that are relevant to fairness; the actual hidden outcome is never an input to \(Q\). Everything else is explained as a trade-off.

### 6.5 Expert consensus

The default workflow is two independent tactical reviewers plus an adjudicator who did not author the case. A reviewer-supported line is an exact action + qualifier pair the reviewer independently marks preferred and assigns a proposed Q value. A 5–7-person compensated role-diverse panel is reserved for initial calibration and contentious cases; its time and cost must be recorded rather than hidden inside the mature-case estimate.

| Classification | Rule | Publication treatment |
|---|---|---|
| Clear consensus | Two reviewers independently agree on the top set and the adjudicator confirms; calibration panels require at least 70% support | Normal scored daily |
| Shared consensus | Reviewers support two lines and the adjudicator confirms; calibration panels require joint coverage of at least 80% | Every co-preferred pair has Q at least 90 and remains within 5 points |
| Context-sensitive | Missing variable reverses the answer or ratings remain materially bimodal | Rewrite, reject, or publish unscored as Debatable Call |

When the two reviewers disagree, the adjudicator reviews their written state assumptions without seeing player popularity, may accept both lines as shared consensus, or requests revision/rejection. The adjudicator may not discard a reviewer-supported line without a recorded factual or rubric reason. A line is “fairly represented” only when the final rubric accepts the same action + qualifier pair and its adjudicated Q is within five points of that reviewer's proposed Q. Gate 2 audits all reviewer-supported pairs in its case sample.

Ordinary-player popularity is an ambiguity signal, never the truth source.

### 6.6 Confidence calibration

Ask:

> How confident are you that this is a defensible call?

MVP records only the four labels defined in Section 5.4 and does not map them to numeric probabilities. Confidence is unscored and is excluded from streaks and distributions. Formal calibration is deferred to V1.1 until enough behavior exists to validate a probability mapping; it uses only scored official cases and requires at least 15 eligible samples.

### 6.7 Corrections

Published case and rubric versions are immutable.

If an accepted line was missing:

- publish a new revision and visible correction;
- preserve completion and participation;
- recalculate only when the same versioned inputs permit fair deterministic recalculation;
- otherwise void the affected score or act and award neutral/full credit;
- never silently rescore players.

---

## 7. State and attempt semantics

| State | Event and guard | Server acknowledgement / next state |
|---|---|---|
| No case | No currently released edition | Show neutral unavailable state; released practice may remain accessible |
| Available | Server selects edition; browser requests attempt | Issue opaque attempt bound to anonymous token, edition, and rubric revision → Briefing |
| Briefing | Player may inspect all public facts | Continue → Read open |
| Read open | Exactly two valid evidence IDs selected | Continue → Call open |
| Call open | One valid action, valid qualifier, and confidence label selected | Continue → Confirming |
| Confirming | Player may go back; confirm sends main idempotency key | First accepted valid commit wins → Main locked |
| Main locked | Server stores immutable main answer | Return follow-up stimulus only → Follow-up open |
| Follow-up open | Required valid New Information or Economy/Risk response selected | Confirm sends follow-up idempotency key |
| Follow-up locked | First accepted follow-up commit wins | Freeze official result, award participation, mark `decision_complete`, release canonical continuation → Debrief |
| Debrief | Player reads result; final principle reached marks `debrief_complete` | Continue → Complete |
| Complete | Result remains frozen; decision and debrief completion are reported separately | Share, review, or enter separate Practice mode |
| Result pending | Commit acknowledged but score response was lost/delayed | Retry retrieves same result; never accepts another branch |
| Version conflict | Attempt revision no longer valid before a commit | Preserve draft, explain conflict, refresh public state; do not consume participation |
| Withdrawn/void | Publishing status changed | Stop new official commits; apply status policy in Section 9 |
| Practice | Separate released-case attempt with `official=false` | May replay; never changes official result or edition credit |

Rules:

- Local offline work is a **draft only**. No answer is officially locked and no score/debrief is released until the server acknowledges the commit.
- A start or draft does not consume daily credit. Participation is awarded when both main and follow-up commits have been acknowledged.
- `decision_complete` means both official commits were acknowledged; `debrief_complete` additionally means the player reached the final transferable principle. Participation does not require the latter, but product-value and retained-case metrics report it separately and never relabel a skipped debrief as learning completion.
- One client-generated idempotency key is used for each commit; concurrent or repeated requests return the first accepted state.
- Refreshing/reopening restores the latest server-acknowledged state plus any compatible local draft.
- A lost response never permits a changed answer to replace a server-locked answer.
- Withdrawal, correction, and scoring status are orthogonal publishing/result attributes, not hidden alternate gameplay branches.

---

## 8. Accessibility, mobile, keyboard, and motion requirements

### Mobile and touch

- Phone portrait is the primary interaction target.
- Minimum controls are 44×44 CSS pixels; primary controls prefer 48 pixels.
- No hover, right-click, drag-only, or precise pin placement.
- The decisive summary and current control fit a portrait viewport; vertical scrolling and collapsible supporting details are allowed.
- Optional zoom has visible controls and does not fight page scrolling.
- No decision requires pinch-zoom or horizontal page scrolling; a text-first path is always available.
- Primary actions respect safe areas and browser/keyboard resizing.
- Required answers do not require typing.
- Long labels wrap; no horizontal overflow at narrow widths.
- Switching between diagram and text preserves selections and view state.

### Tactical diagram

- Use an original abstract zone-and-route schematic, not copied Valve radar art.
- The core interaction targets zones and relationships, not pixels.
- Confirmed, stale, inferred, alive/dead, and team states differ through shape, stroke, pattern, text, and color.
- A complete structured text/list representation exposes equivalent information.
- Tapping or focusing a zone/player opens a readable detail surface.

### Keyboard

- Logical tab order follows briefing → evidence → call → confidence → confirm → follow-up.
- Every control has a visible focus state.
- Number shortcuts may select options when focus is not in a text field.
- Enter activates; Escape closes a temporary surface and restores focus.
- Ordering supports arrow keys and explicit move controls.
- Dialogs manage and restore focus correctly.

### Screen readers

- Clear landmarks and one primary heading per state.
- “Skip to decision” after the briefing.
- Diagram has a structured equivalent, not generic alt text.
- Selection changes are announced once and politely.
- Commitment moves focus to the next state heading.
- Result summary precedes detailed analysis.
- Distributions and charts expose values and conclusions as text.

### Color and motion

- Meet WCAG 2.2 AA, including contrast, reflow at 200% zoom, focus visibility/order, target size, labels, status messages, and error identification.
- Never rely on CT/T color or green/red correctness alone.
- Reduced-motion mode removes path tracing, pulsing, parallax, and movement-based reveals.
- Reconstruction offers pause, step, replay, and show-final-state controls.
- No result is hidden behind an unskippable animation.

Before public beta, verify at minimum VoiceOver with Safari on a current iPhone, TalkBack with Chrome on a current Android device, NVDA with Firefox on Windows, keyboard-only operation, 320 CSS-pixel width, 200% zoom/reflow, and reduced-motion mode. Exact supported versions are locked in the later test plan.

### Timers

There is no response timer in MVP. The round clock is frozen evidence or advances only when the user explicitly steps the authored continuation.

---

## 9. Today, reset, participation, streaks, archive, and accounts

### Today entry

Show only:

- case number and explicitly labeled UTC edition date;
- estimated duration;
- broad focus such as Economy, Information, or Retake;
- current player-facing status from the mapping below;
- one primary action;
- optional first-time “How it works.”

If revealing match/player identity would disclose the continuation or invite lookup, hide it until after the follow-up commit. This choice is an explicit case field, not an editorial improvisation.

| Internal condition | Today status | Primary action | Credit behavior |
|---|---|---|---|
| Released, no attempt | New | Start case | None yet |
| Draft or acknowledged partial state | In progress | Continue | None until both commits |
| Commit acknowledged, result retrieval delayed | Result pending | Retry result | Credit appears only from the authoritative accepted result |
| Pre-commit revision conflict | Update required | Refresh case | Draft preserved where compatible; no credit consumed |
| `decision_complete`, debrief not finished | Decision complete | View debrief | Participation awarded; debrief completion still open |
| `debrief_complete` | Complete | Review or share | Participation awarded |
| Prior edition still inside grace | Previous case in progress | Resume previous | Credits its original UTC edition |
| Official window expired without completion | Practice available | Play practice | No official credit |
| Corrected | Corrected | Read correction | Apply Section 9 score-status policy |
| Withdrawn or void | Withdrawn | View neutral record | Preserve earned participation; adjust denominator per policy |
| No current release or outage before attempt | Unavailable | Retry later | No alternate edition or consumed credit |

### Reset

- Official reset: **00:00 UTC**, server authoritative.
- Browser clock is display-only.
- An attempt token issued before reset may finish for the original edition within a **12-hour completion grace window**.
- After the grace window, the case remains available as practice but cannot create official daily credit.
- During grace, Today shows the new edition as primary and a separate Resume previous edition action. Finishing the previous attempt credits its original edition.

Twelve hours is the beta lock. Beta data may support a later PRD revision, but implementation and testing use 12 hours until that revision is approved.

### Retention model

Primary progress is edition-based, not calendar-day-based:

- Three-edition closed beta: complete at least 2 of the latest 3 released editions.
- Daily public cadence: complete at least 4 of the latest 7 released editions.
- Consecutive-edition streak may appear secondarily only after daily publishing begins; no calendar-day streak is shown in the three-per-week beta.
- No streak freezes, paid repairs, or fear-based loss messaging in MVP.
- Assisted completion counts.
- A withdrawn/voided case preserves participation.

### Archive and practice

- A completed case remains reviewable only while its source/asset rights permit. A rights withdrawal retains a neutral history record and participation status but may remove the case/debrief.
- Released missed cases may be played later.
- Practice uses the same engine and scoring model.
- Replays never replace the official result.
- Practice unlocks after the edition's official window ends or after the user's official completion, may be replayed indefinitely while rights permit, and does not contribute to participation, retention, distributions, streaks, or lens progress.
- Future cases and schedules never appear in client-accessible responses.
- Corrections are visible and tied to immutable revisions.

All released cases remain free during validation. A recent-free/full-paid archive is a V1.1 monetization experiment, not an MVP assumption.

### Publication and score-status policy

| Case/result state | New official play | Score | Participation / edition denominator | Practice/review |
|---|---:|---|---|---|
| Released, scored | Yes during official window | `scored` | Counts | Yes after completion/window |
| Unscored Debatable Call | Never used as official MVP edition | `unscored`, `score=null` | Excluded | V1.1 practice/editorial feature only |
| Corrected, score still valid | No new play on old revision | Original score retained with notice | Counts | New revision may be practice; no second official attempt |
| Corrected, deterministic recalculation valid | No new play on old revision | Recalculate from frozen inputs; show notice and both revision IDs | Counts | New revision practice only |
| Corrected, fair recalculation impossible | No | `void` | Attempted users keep credit; edition removed from denominator for others | Neutral history; practice only if fixed and rights allow |
| Withdrawn for rights/source issue | No | `void` or retained only if contract permits | Attempted users keep credit; edition removed from denominator for others | Debrief/content removed as required; neutral record remains |
| Pending validation/outage | No alternate branch | `pending` | No credit until accepted, then normal | Retry same idempotent request |

### Anonymous model

MVP requires no account.

- Local device storage holds history and preferences.
- The server uses an opaque random browser-held pseudonymous token and attempt IDs; no device fingerprinting.
- Clearing storage or changing browser may produce a fresh identity; this is an accepted limitation.
- Users can clear local progress.
- “One official result” means one result per anonymous token and edition, not one verified human.
- If durable storage is unavailable, session-only play is allowed but official credit lasts only while the issued attempt token remains available; the product states this limitation.

### Optional accounts

Accounts enter V1.1 only if cross-device demand, private groups, paid entitlements, or durable history justify them. The signup invitation appears after value has been delivered, never before or during the daily case.

Anonymous-to-account migration must be explicit, reversible where feasible, and protected from overwriting newer server history.

---

## 10. Progress, analytics, and sharing

### Progress

Keep lenses stable and small:

- Economy
- Information
- Timing
- Map control
- Teamplay
- Risk

Do not claim that performance predicts FACEIT level, rank, or actual match skill.

Before enough data exists, show only participation and sample count. A lens-level profile requires at least five scored official samples in that lens and 15 scored official cases overall. Assisted cases count for participation but are excluded from lens performance until beta proves the hint is score-neutral.

Possible later insights:

- best-supported versus defensible selections;
- recurring evidence overlooked;
- confidence calibration;
- performance by broad lens;
- recent improvement, without spurious precision.

Answer distributions are withheld until the requesting anonymous token has completed the official case and at least 100 eligible official scored attempts exist. They exclude practice, void, unscored, and suspicious automated attempts; assisted attempts are segmented. No public pre-completion distribution endpoint exists. If the threshold is not met, show “not enough responses yet.”

### Product analytics

Privacy-conscious aggregate events:

- Today loaded;
- case started/resumed;
- each state reached;
- assisted context used;
- main call committed;
- follow-up committed;
- debrief opened and completed;
- source section opened;
- share invoked;
- “missing line” or correction report submitted;
- archive/practice started;
- return visit and rolling retention.

Do not put raw explanations, reports, IP addresses, unpublished content, or answer text into product analytics.

### North-star and supporting metrics

North star:

> **Weekly retained anonymous IDs:** distinct pseudonymous tokens completing at least two released editions in a rolling seven-day window.

This is a browser-token metric, not a verified-person count. Suspected duplicate/bot patterns are excluded from product analysis under a documented rule and never used to punish ordinary shared-network users.

Supporting metrics:

- start rate;
- starter completion rate;
- median session duration;
- debrief consumption;
- seven-day return;
- voluntary second-case play;
- fairness/missing-line rate;
- synthetic vs professional performance;
- content hours per approved case;
- buffer days remaining;
- correction/withdrawal rate.

### Spoiler-free sharing

Share output may include:

- case number/date;
- overall numeric score;
- three component marks/patterns;
- confidence level;
- weekly participation.

It must not include:

- map, team, player, event, or round identity;
- selected action, route, rationale, or follow-up events;
- answer-dependent prose;
- a misleading “verified” badge on editable share text.

MVP sharing is copy text plus the browser's native Web Share text payload only. It contains no share URL, server-generated image, OG preview, or public result endpoint. A visual card or signed share route, if later added, requires a new spoiler review; its HTML, metadata, previews, and unauthenticated responses may not contain case identity, debrief, actions, evidence, follow-up facts, or answer-bearing fields, and equivalent accessible text remains mandatory.

---

## 11. Content model and operating system

### 11.1 Case package

Every case is a versioned editorial object containing:

1. Case frame and player-visible information.
2. Decision options and qualifiers.
3. Reason/evidence tags.
4. One follow-up module.
5. Complete rubric and accepted alternatives.
6. Debrief, counterfactual, and transferable principle.
7. Identity, review, source, rights, patch, scheduling, and correction metadata.

Minimum normative fields:

| Group | Required fields |
|---|---|
| Identity/release | `case_id`, `edition_id`, `case_origin` (`synthetic` or `professional`), immutable `case_revision`, `rubric_revision`, publication status, release/reset/grace timestamps, content checksum |
| Ruleset | build, MR/regulation/overtime format, round/buy/freeze phase, timer rules, economy/loss-income/award rules, inventory limits, movement/travel model, map/schematic version |
| Environment | declared objective, coordinated/pro/ranked environment ID, communication assumption, visibility/audio assumption, player decision authority |
| Public state | side, score/round, clock, bomb, alive/health, money/inventory/utility, public map zones/routes, confirmed/last-seen/inferred/unknown facts |
| Main answer | 3–5 action IDs, valid 2–4 qualifier IDs per action, exactly five evidence IDs with all ten distinct unordered pairs valid per action, four confidence labels, structured report categories |
| Follow-up | enum (`new_information`, `economy_risk`); versioned stimulus; finite `keep_original`/`change_to(action_id, qualifier_id)` responses or valid posture/priority pairs |
| Server-only scoring | dimension template, Q per action/qualifier, E matrix, F matrix, caps, bands, admissible-state set, accepted aliases |
| Server-only reveal | canonical continuation, observed professional action/outcome if any, alternatives, counterfactual, explanation fragments |
| Provenance/rights | field-level source records, license/usage basis, attribution, expiry/termination/takedown behavior, identity/publicity/media clearance, source snapshot/checksum |
| Governance | author, two reviewer sign-offs, adjudicator, rights approver, lock event, correction owner/lineage, substitute case |

Minimum attempt fields:

- anonymous token reference;
- attempt ID, edition/revisions, and `official|practice` mode;
- current acknowledged state and monotonic sequence number;
- main/follow-up idempotency keys;
- hint/assisted flag;
- committed action, qualifier, evidence, confidence, and follow-up IDs;
- result/score/publication status;
- created, committed, completed, grace, and correction lineage timestamps.

The server-only canonical continuation and actual professional outcome are expressly prohibited inputs to Q, E, and F. A deterministic test changes the hidden outcome while holding the player-visible case/rubric constant and requires an identical score.

### 11.2 Scenario families

| Family | Core tension |
|---|---|
| Economy allocation | Present round equity versus future buy |
| Round opening | Contest/default/pressure versus utility conservation |
| Information expiry | Act, re-clear, hold, or gamble on stale information |
| Map control | Space versus manpower and utility |
| Man advantage | Preserve the edge versus increase pressure |
| Man disadvantage | Create volatility without donating fights |
| Mid-round commitment | Fake, recommit, rotate, or freeze |
| Anchor and rotation | Help early versus protect the second site |
| Bomb logistics | Retrieval, transfer, safe plant, and late routes |
| Site execution | Utility sequence, entry order, spacing, and reserve |
| Post-plant | Position, clock, utility, and trade geometry |
| Retake or save | Round value versus economic preservation |
| Clutch | Information manipulation and fight isolation |
| Conversion | Avoiding anti-eco and low-buy failure |
| Adaptation | A new fact invalidates the original plan |

A new map, clock, or player count is not sufficient differentiation. Every case needs a distinct cognitive conflict.

### 11.3 Repetition controls

Scenario signature:

`family + primary dilemma + side + phase + manpower + economy + topology + follow-up type`

Rules:

- no primary family on consecutive days;
- no same map on consecutive days;
- no substantially similar dilemma within 14 days;
- no scenario shell more than three times per quarter;
- repeated shells must change the central trade-off;
- rolling 60-day schedule receives human similarity review;
- taxonomy audit after every 20 published cases.

### 11.4 Editorial workflow

`Pitch → Feasibility → Draft → Rubric complete → Tactical review → Revision → Source/rights review → Copy/accessibility QA → Approved → Scheduled → Locked → Published → Monitored → Archived/corrected`

Roles:

| Role | Responsibility |
|---|---|
| Case designer | State, options, rubric, follow-up, debrief |
| Two tactical reviewers | Independent plausibility, omitted lines, fairness, and proposed top set |
| Tactical adjudicator | Resolves reviewer disagreement; cannot be case author |
| Research/source editor | Provenance and commercial-use basis |
| Copy/accessibility editor | Clarity, reading load, nonvisual equivalence |
| Publishing editor | Schedule, revision lock, patch state, substitute |
| Legal adviser | Periodic review of data, trademark, media, and agreements |

Every scored public case has an author and two independent tactical reviewers. The adjudicator is never the author and must be a separate third reviewer when the two initial reviews disagree; when they independently agree, one of them may record the adjudication check. Professional cases also require an independent source reviewer.

### 11.5 Authoring acceptance checklist

All must be true before scheduling:

- State is mechanically possible under the bound ruleset.
- Clock, routes, economy, utility, health, and equipment reconcile.
- Player sees only legitimate perspective information.
- Information quality is explicit.
- Diagram has a complete text equivalent.
- Decision contains a real conflict between legitimate objectives.
- Options are distinct, operational, and similarly specific.
- At least two defensible lines are represented unless alternatives are objectively impossible.
- Every legal option has an authored rubric profile.
- All ten distinct evidence pairs have an E value for each of the 3–5 actions: 30–50 reviewed evidence cells, with none disabled in the player UI.
- Required assumptions are explicit.
- Follow-up tests adaptation rather than repeating the first decision.
- Strongest alternative is explained fairly.
- Recommendation and professional outcome are separated.
- Synthetic cases visibly distinguish sourced mechanics/facts from editorial judgment and counterfactual interpretation.
- Ruleset and revision are locked.
- Two independent reviewer sign-offs and adjudication are recorded; author is not the adjudicator.
- Rights status is green.
- Sources, usage basis, and access dates are stored.
- No unlicensed media is present.
- Mobile, keyboard, screen-reader, and reduced-motion QA are complete.
- Professional dates have a synthetic substitute.
- Correction owner is assigned.

### 11.6 Patch and version policy

Every edition binds:

- game build or valid build window;
- economy ruleset;
- map-pool snapshot;
- schematic version;
- rubric revision;
- source revision.

Rules:

- Re-review affected scheduled cases after material CS updates.
- Do not publish patch-sensitive cases within 48 hours of a major update without revalidation.
- Rubric changes create a new revision.
- Archived mechanics cases display “rules as of.”
- Professional cases remain tied to their historical build.
- If invalid at publication, withdraw, preserve participation, void affected scoring, and publish a correction.

### 11.7 Human-hours and staffing reality

Mature estimates:

| Work | Synthetic | Professional reconstruction |
|---|---:|---:|
| Concept/state | 1.25 h | 2.0 h |
| Research/provenance | 0.25 h | 2.5 h |
| Rubric/counterfactual | 1.25 h | 1.5 h |
| Diagram/text equivalent | 0.5 h | 1.0 h |
| Two tactical reviews/revision | 1.5 h | 2.5 h |
| Adjudication | 0.5 h | 0.75 h |
| Copy/accessibility/source QA | 0.6 h | 1.2 h |
| Scheduling/final validation | 0.25 h | 0.4 h |
| **Expected total** | **about 6–7 h** | **about 12–14 h** |

Early cases will likely take 9–12 synthetic hours and 16–22 professional hours.

At six synthetic and one professional case per week, expect approximately 55–65 total content-operations hours, including monitoring and meetings. A credible daily operation is approximately 1.4–1.7 FTE spread across at least three qualified contributors, plus periodic legal review.

At a blended specialist rate of US$60–100/hour, direct content labor is approximately US$14,000–28,000/month before licensing, engineering, design, support, and legal expense. Founder labor can reduce cash expense, not the workload.

---

## 12. Source, data-rights, and asset strategy

This section is a product-risk assessment, not legal advice. Formal permission or counsel is required before monetization where rights remain unclear.

### 12.1 Rights layers

| Layer | Question |
|---|---|
| Fact | Is the statement accurately and credibly sourced? |
| Access permission | Does the site/API allow this retrieval method? |
| Data license | May we store, transform, display, archive, and monetize the dataset? |
| Media rights | May we use the image, footage, audio, logo, map art, or likeness? |
| Parser license | May we use the parsing software? This does not grant demo rights. |

“We can download it” is never a rights status.

### 12.2 Source matrix

| Source | Use | Product decision |
|---|---|---|
| Valve patch notes, announcements, rules/VRS | Mechanics, rules, isolated official facts | Primary sources; cite, do not bulk republish assets/data without permission |
| Tournament organizers | Results, rosters, rulings, event context | Primary facts; no assumed media/database license |
| Wikidata | IDs, aliases, dates, relationships | Safest open graph seed under CC0; verify important facts |
| Liquipedia API | Discovery and cross-checking | API only; attribution/share-alike compliance; do not clone as proprietary canonical graph |
| GRID Open Access | Selected official historical CS2 telemetry | Best prototype route only after written purpose/usage confirmation |
| Commercial GRID | Official granular data | Best long-term candidate; negotiate exact derivative/archive/monetization rights |
| PandaScore | Fixtures/results; higher tiers for historical/replay | Not an archive foundation without negotiated permanent derived-content rights |
| Abios | Schedules/results/stats | Compare only after exact fields and archive rights are disclosed |
| Licensed demo files | Tick/event states | Strong if explicitly licensed; keep raw files private |
| HLTV | None operational | Never scrape or use as data pipeline |
| Broadcast/game media | Optional storytelling | Avoid in MVP unless independently cleared |

### 12.3 Current findings

- GRID's public pages describe free Open Access for qualifying non-commercial or pre-revenue users and selected historical CS2 telemetry. Its linked 2022 agreement is purpose-specific, tied to upstream rights, contains a €10,000 annual product-revenue threshold, and treats feeds/data as confidential. Written confirmation is required for public derivative puzzles, archives, ads/subscriptions/sponsors, cloud subprocessors, stored normalized states, and post-termination retention.
- PandaScore's current public pricing lists fixtures/context at €0, historical/post-match from €400 per videogame/month, and Basic Live/Replay from €1,000 per videogame/month. Its terms allow processed work and require attribution, prohibit raw resale, and require use of accessed data to stop on termination. A premium archive is too close to the paid purpose to assume coverage without an addendum.
- HLTV's terms prohibit scraping/data mining, commercial exploitation, and constructing a similar or competitive product. It is excluded entirely.
- Liquipedia's API terms require API access rather than automated HTML, rate limits, caching, and attribution under CC BY-SA. Media licenses vary by file.
- Wikidata's structured data is CC0 and can seed canonical identities, but it is not an authoritative source by itself.

Every professional fact displayed or used in scoring must link to a field-level provenance record and a preserved source snapshot/checksum where contractually permitted. Rights approval records the evidence reviewed, permitted surfaces, required attribution, expiry/termination trigger, takedown owner, and what may remain in anonymous history after withdrawal. “Green” means these fields are complete and approved; unknown or amber material cannot be scheduled.

Synthetic-only public beta requires a pre-launch trademark/asset/privacy review. Any public professional reconstruction additionally requires rights/legal approval before exposure, not merely before monetization. Gate 0 blocks professional content only; it does not block a fully original synthetic MVP.

### 12.4 Recommended pipeline

**Now**

- Original synthetic cases.
- Valve/TO primary facts.
- Wikidata for open identity relationships.
- Liquipedia only for compliant discovery/cross-checking.

**Prototype real rounds**

- Apply to GRID Open Access.
- Obtain written confirmation for the exact public use.
- Contact at least one tournament organizer or rights holder.
- Use no professional label until provenance and rights gates pass.

**Commercial real rounds**

- Negotiate GRID or direct organizer terms covering worldwide commercial display, derivative puzzles, archive, private raw storage, subprocessors, correction evidence, and post-termination treatment.
- Consider PandaScore only with a custom archive/monetization addendum.

**Never**

- HLTV scraping.
- Unlicensed demo mirroring.
- Copied broadcast frames, radar art, game audio, weapon images, team logos, or player photos.

### 12.5 Demo-derived professional cases

For every explicitly licensed demo:

1. Parse event/tick state.
2. Detect candidate turning points.
3. Select a state 8–20 seconds before the decision.
4. Reconstruct only information plausibly known to the chosen side.
5. Remove omniscient state.
6. Human-review vision, sound, and communicated-information assumptions.
7. Define accepted action families and trade-offs.
8. Present the observed professional action separately from tactical grade.

Demo ticks alone cannot prove what a player saw, heard, or received through comms. A decisive information item must have separately verified visibility/audio/comms evidence; otherwise label it inferred and exclude it from score-determining facts. Team/player identity also requires the documented trademark/publicity-use review appropriate to the intended surface.

The technical license of a demo parser does not grant rights to the source demo.

### 12.6 Asset policy

- Use Counter-Strike and map names descriptively with an unofficial-product disclaimer.
- Do not imply Valve, team, tournament, or player endorsement.
- Use original abstract tactical schematics.
- Send exact recognizable map geometry for legal review before commercial launch.
- Treat community callouts as aliases, not universal truth.
- Avoid team logos, player photos, screenshots, radar textures, sounds, and broadcast media in MVP.

Valve's Steam Subscriber Agreement generally permits Valve fan-art content only on a non-commercial basis unless another permission applies. Valve's video policy allows certain platform monetization but does not allow extracted game assets to be distributed separately. The product should therefore be designed to work without Valve-owned media.

### 12.7 Sensitive historical claims

For cheating, bans, match manipulation, betting violations, suspensions, or disciplinary action:

- prefer final Valve, tournament-organizer, league, court, or ESIC rulings;
- distinguish allegation, investigation, interim action, final decision, and appeal;
- distinguish cheating, non-cooperation, match manipulation, and betting violations;
- store issuing authority, exact scope, decision date, effective period, appeal status, and approved wording;
- require senior human editorial approval;
- never generate or rewrite the claim from AI memory.

---

## 13. AI interpretation and “free grading” decision

### Decision

AI does not determine the official MVP score.

The commercially defensible path is **AI-assisted interpretation into a closed authored rubric**, followed by user confirmation and deterministic scoring. AI may understand prose; humans still define tactical truth.

### Why a free AI referee is rejected

- Model judgments are nondeterministic and difficult to appeal.
- LLM judges show scoring and position biases.
- Free quotas can change, fail, or become capacity-limited.
- Provider/model terms differ and must be rechecked.
- Prompt injection and adversarial prose create a larger attack surface.
- A model update could change yesterday's result.
- Multilingual and concise answers may be treated inconsistently.

### Candidate experiment

Cloudflare Workers AI is the preferred V1.1 provider to evaluate **only after the structured core passes its retention gate and user research demonstrates demand for free-text interpretation**. It fits the required hosting platform and currently offers:

- a 10,000-neuron daily free allocation;
- paid overage at $0.011 per 1,000 neurons;
- models that remain available on the Free plan, including Gemma 4 26B A4B;
- Gemma 4 under a commercially permissive Apache 2.0 license;
- documented ownership of customer inputs/outputs and no use for training or service improvement without explicit consent.

Do not lock a model in Phase 1. Benchmark at least:

- a small, low-cost model that Cloudflare currently lists for JSON Mode, such as the active Llama 3.1 8B fast variant; and
- a stronger commercially permissive candidate such as Gemma 4 26B, using function calling or separately validated output when JSON Mode support is unavailable.

Model choice must consider classification quality, license, schema-valid rate, latency, neuron use, and deprecation risk together. Cloudflare explicitly does not guarantee that JSON Mode will satisfy every requested schema, and its catalog changes over time. Pin an exact model ID for a release, keep regression tests, and rerun the benchmark before migrations.

An open model license does not itself grant service-level privacy, retention, capacity, or commercial terms. Recheck both the model license and Cloudflare service/data terms at the release date.

This is suitable for beta economics, not a promise of perpetual free production. Capacity and quota failures must degrade to the complete deterministic experience.

At the model page's token-unit illustration of $0.10 per million input and $0.30 per million output tokens, a small classification call can be very inexpensive, but actual Cloudflare billing remains neuron-based. Measure real usage rather than budgeting from a token estimate alone.

### V1.1 shadow-mode flow

1. Player commits the structured official answer.
2. Player optionally writes a short explanation.
3. Model receives only the released case, an allow-listed rationale ontology, and sanitized text.
4. Model returns strict structured output: action ID, rationale tags, assumption tags, quoted evidence spans, and parser confidence.
5. Server verifies that every evidence span is a literal substring of the submitted answer and rejects unknown IDs/keys.
6. Invalid, unknown, malformed, or low-confidence output abstains.
7. Player may confirm/correct the interpretation.
8. Authored feedback fragments create an optional coaching note.
9. The official score remains unchanged during the pilot.

### V2 eligibility for confirmed interpretation

AI may become an input interpreter—not a judge—only if:

- the player confirms the interpreted structured answer before scoring;
- the deterministic rubric scores the confirmed IDs;
- the no-AI structured path remains available;
- the model cannot see future cases or privileged editorial material;
- model/provider version is recorded;
- outages and spend ceilings fall back safely;
- a human-labeled benchmark and adversarial set pass release thresholds.

Proposed pre-public benchmark:

- at least 500 English labeled responses across 30+ cases as a minimum pilot corpus, expanded when power/confidence-interval analysis shows a metric lacks precision;
- multiple answer lengths, skill levels, dialects, and writing styles; multilingual interpretation is a separate later benchmark;
- explicit adversarial, contradictory, irrelevant, encoded, and personally identifying inputs;
- macro-F1 at least 0.90 on core action/rationale tags;
- per-tag recall at least 0.85;
- false confident mapping below 1% on normal and adversarial sets;
- 100% abstention or safe handling for invalid output shapes;
- at least 99% schema-valid responses after at most one bounded retry;
- at least 99% completion including the deterministic fallback;
- p95 feedback latency at or below 3 seconds where feasible;
- no material unexplained performance gap by answer-length/writing-style slice;
- expert review of all disagreements that could change a score.

Every rate states its exact denominator and a confidence interval. These thresholds are provisional product guardrails, not proof of universal accuracy. If they are not met, AI remains unscored coaching or is not exposed.

### AI security and privacy boundaries

- No browsing, tools, database writes, or privileged actions.
- Invoke only after main-call commitment, or withhold output until commitment.
- Never send future cases, confidential feeds, raw demos, unrelated history, or full hidden rubric.
- Strict input length, token, rate, time, and daily cost limits.
- Use a short UX timeout (target 2–5 seconds) and at most one bounded retry; do not delay completion.
- Treat all text and model output as untrusted plain text.
- Do not retain raw explanations by default; sampled evaluation requires consent and de-identification.
- If AI Gateway is introduced, disable request/response payload logging by default while retaining only necessary aggregate metadata.
- Disclose possible misunderstanding and provide “My line was missed.”
- Licensed-provider data may be sent to a model only when both licenses permit it.

---

## 14. Security, anti-cheat, and privacy requirements

The MVP protects unreleased cases/rubrics, official result integrity, ordinary availability, and anonymous privacy. It does not claim casino-grade integrity.

### P0 requirements

1. **Server-authoritative edition and reset.** Device date/time cannot select another edition.
2. **Server-authoritative state and score.** Client submits choices, never result values.
3. **No answer leakage.** Pre-commit payloads contain no rubrics, bands, explanations, counterfactuals, hidden flags, future states, or future cases.
4. **Opaque attempt identities.** Attempt is bound to case and rubric revision.
5. **Commit-once, idempotent retries.** Concurrent/double submission yields one official branch and retrievable result.
6. **Released-only archive.** Guessing IDs/dates does not authorize unpublished content.
7. **Strict validation.** Request shape, option IDs, state transitions, text lengths, and revisions fail safely.
8. **Untrusted rendering.** User/model text renders as inert text, never executable HTML/Markdown.
9. **Controlled publishing.** Only approved, rights-cleared, locked content can schedule.
10. **Proportional rate limits.** Stricter limits for enumeration, attempt creation, reports, and later AI; shared networks are not treated as one player.
11. **Correction/withdrawal.** Withdrawn cases stop issuing results and preserve participation fairly.
12. **Data minimization.** Random pseudonymous IDs, no fingerprinting or cross-site ad tracking.

### Accepted MVP risks

- A user can learn the answer elsewhere.
- Clearing storage or changing browser may create a new anonymous attempt.
- Someone can post screenshots after completion.
- Current public case facts can be scraped.
- Copied share text can be edited.
- Anonymous local history can be lost.

These are acceptable without prizes or global rankings. Stronger controls are required before adding either.

### Privacy notice requirements

Explain:

- local device storage and its loss/reset behavior;
- pseudonymous server attempt records;
- analytics categories;
- retention periods and deletion/reset controls;
- optional AI processing when introduced;
- that users should not enter personal information.

Proposed maximum MVP retention:

| Data | Maximum |
|---|---:|
| Local progress/preferences | Until the user clears it or browser storage removes it |
| Pseudonymous server attempt records | 90 days, then delete or irreversibly aggregate unless an account user explicitly retains history |
| Coarse network/rate-limit signals | 7 days |
| Operational/security logs | 30 days, with unpublished answers and raw prose excluded |
| Correction/missing-line reports | 90 days, then delete or de-identify |
| Raw AI explanations | Not retained by default; separately opted-in evaluation samples maximum 90 days |

The product provides Clear local progress and a token-proven Delete server history action. Deletion should complete within 30 days, subject only to narrowly documented legal/security exceptions. Exact lawful basis, consent/local-storage treatment, age policy, processor terms, and regional requirements must pass privacy/legal review before public beta.

Design for an audience that may include minors: no behavioral advertising, invasive profiles, or unnecessary personal fields. Do not target children under 13, but do not assume a no-login design removes child-privacy obligations. Free text remains absent from MVP, and V1.1 AI input requires a separate privacy review and explicit notice.

---

## 15. Release scope

### Risk-reducing rollout

| Stage | Included |
|---|---|
| Mechanics alpha | Today → briefing → exactly two evidence choices → main call/qualifier/confidence → New Information follow-up → canonical continuation → debrief; no sharing, progress profile, distributions, or archive UI |
| Closed beta | Add Economy/Risk follow-up, persistence/resume, 2-of-3 edition consistency, correction reports, eligible distributions, and released-case practice |
| Public MVP | Add spoiler-safe sharing, recent archive/review, basic participation history, and lens progress only after its sample thresholds |

This is one product scope delivered in evidence-gated slices, not three separate products.

### MVP

In scope:

- One shared Daily Round Review format.
- One main call, exactly two evidence selections, confidence label, follow-up stimulus, one follow-up, canonical continuation, and debrief.
- Mandatory tactical-decision nodes.
- Exactly two MVP follow-up contracts: New Information and Economy/Risk.
- Synthetic cases, original diagrams, and text equivalents.
- Several accepted answer paths and deterministic server-authoritative grading.
- Full debrief and source/method display.
- No-login anonymous play and local history.
- Server-issued edition/attempt identities.
- 00:00 UTC reset and locked 12-hour beta completion grace.
- Edition-based consistency, daily-only consecutive-edition streak, recent rights-contingent archive, and practice.
- Spoiler-free native/text sharing.
- Basic progress after sufficient samples.
- Hints/glossary and Guided/Standard explanation depth.
- Correction and “missing line” feedback.
- Provenance, rights, patch, review, and correction metadata.
- Privacy-conscious product analytics.
- Responsive, accessible mobile and desktop behavior.

Out of scope:

- Separate Arcade, Pro, Connections, Grid, Crossword, Millionaire, or guessing modes.
- Mandatory accounts and sync.
- Paid features or advertising inside a case.
- Global leaderboards, prizes, ranks, or ELO.
- Live statistics and automatic demo-to-publish pipeline.
- AI-generated official scores or required prose.
- Community-authored cases.
- Unlicensed game, broadcast, team, tournament, or player media.
- Adaptive difficulty and native apps.

### V1.1

Only after core retention and content gates:

- Optional accounts and cross-device sync.
- Expanded archive and filters.
- Stable lens-level knowledge profile.
- Practice tracks: economy, information, rotations, objective play, risk.
- Up to one or two rights-cleared professional cases per week.
- AI rationale classification in shadow mode.
- Optional authored/AI-assisted personalized coaching with cost limits.
- Private friend groups rather than public rankings.
- Weekend embedded-puzzle experiment.
- Evidence/Chronology, Prediction, and What Happened Next follow-up experiments.
- Numeric confidence calibration after enough eligible data.
- Correction/rubric history and anonymous-to-account migration.
- Recent-free/full-paid archive experiment if monetization is ready.

### V2

- Licensed professional telemetry/demo pipeline.
- Score-relevant AI interpretation only through confirmed structured mapping and passed benchmarks.
- Full archive, structured learning tracks, mistake review, and advanced progress.
- Expert commentary packs, coach/team sets, and event partnerships.
- Tournament or creator collaborations with editorial separation.
- Reviewed community submissions with publication/monetization rights.
- Translations after tactical-language review.
- Limited Arcade only if flagship retention is healthy and embedded mechanics show independent demand.

### Backlog

- Standalone Connections, CS Grid, Mini Crossword, Millionaire, Timeline, roster reconstruction, career chain, Sound IQ, and GeoGuessr-like modes.
- Public leaderboard or prize modes.
- Live-event companion experiences.
- Native apps.

---

## 16. Content cadence, corpus, and first 90 days

### Cadence gates

#### Closed beta

- Publish three cases per week.
- Minimum inventory: 15 fully approved cases plus 6 emergency evergreen substitutes.
- At least four scenario families.
- No more than two professional cases in initial inventory.
- Complete one simulated correction/withdrawal drill.

#### Production simulation before public daily

For four consecutive weeks:

- produce at least seven approvable cases/week without consuming the buffer;
- maintain a 21-day scheduled buffer;
- keep material post-review rework below 20%;
- keep expert missing-defensible-line findings below 10%;
- record median and 90th-percentile production time;
- prove patch review and professional substitutions work.

#### Public daily launch

- Next 30 dates approved and scheduled.
- At least 15 additional evergreen alternatives.
- At least 15 further released or approved cases, for 60 total reviewed cases.
- Every professional date has an approved synthetic substitute.
- 21-day forward buffer maintained for four weeks.
- No unresolved P0 or P1 factual, fairness, rights, privacy, accessibility, or security finding.

Exactly one edition ID and content checksum are globally locked before each release. A professional slot may be replaced by its synthetic substitute only before that lock; every user then receives the same locked edition. A rights, source, or rules failure after release triggers the correction/withdrawal policy and participation credit—never a silent mid-edition substitution or cohort split.

Buffer triggers:

- below 21 days: freeze experiments;
- below 14 days: remove professional/unusual-format dates;
- below 7 days: reduce public cadence instead of publishing weak work.

### Corpus milestones

| Stage | Inventory | Mix |
|---|---:|---|
| Private mechanics alpha/closed-beta gate | 21 approved cases: 15 scheduled-capable + 6 emergency substitutes | Synthetic |
| Public daily gate | 60 reviewed case-days | Recommended 42 synthetic, up to 12 rights-cleared pro, 6 history/context; pro count may be lower without weakening the core |
| Monetization-ready | 90 case-days | Target 45 synthetic, up to 30 rights-cleared pro, 15 history/context only if rights/economics pass |

Do not market “real pro round review” as a recurring promise until at least 12 rights-cleared professional cases and a repeatable pipeline exist.

### Ninety-day operating plan

| Period | Purpose | Required outcome |
|---|---|---|
| Days 1–30 | Prove the format | Taxonomy/rubric/rights ledger; 21 approved synthetic cases (15 scheduled-capable + 6 substitutes); three cases/week; correction drill |
| Days 31–60 | Prove production | Five-case/week beta; at least 24 additional approved cases; up to 4 rights-cleared pro; 30-date draft calendar; source go/no-go |
| Days 61–90 | Reach public gate | Reach 60 total reviewed cases; lock 30 dates + 15 alternatives + 15 released/approved cases only if retention, fairness, rights, and buffer gates pass; launch after the gate, not merely because day 61 arrived |

### First 30 public case-days

Professional slots always have synthetic substitutes.

| Day | Type | Primary tension | Follow-up |
|---:|---|---|---|
| 1 | Synthetic | CT mixed-buy allocation | Economy/Risk |
| 2 | Synthetic | Stale early-round information | New Information |
| 3 | Synthetic | Protect a 4v3 advantage | New Information |
| 4 | Synthetic | Late-round bomb route | New Information |
| 5 | Synthetic | Post-plant utility preservation | New information |
| 6 | Synthetic | Anti-eco conversion discipline | Economy/Risk |
| 7 | Pro or substitute | Documented mid-round rotation | New Information |
| 8 | Synthetic | Lost map control without confirmed hit | New Information |
| 9 | Synthetic | Two-player retake versus save | Economy/Risk |
| 10 | Synthetic | Last smoke allocation | New Information |
| 11 | Synthetic | Information age and re-clear risk | New information |
| 12 | Synthetic | 1v2 plant-location choice | New Information |
| 13 | Synthetic | Post-pistol force decision | Economy/Risk |
| 14 | Pro or substitute | Documented anti-eco response | New Information |
| 15 | Synthetic | CT man-advantage aggression | New Information |
| 16 | Synthetic | Weak-side anchor death | New information |
| 17 | Synthetic | Fake, recommit, or rotate | New Information |
| 18 | Synthetic | Post-plant trade spacing | New Information |
| 19 | Synthetic | Separated bomb carrier | New Information |
| 20 | Synthetic | Eco damage versus exits | Economy/Risk |
| 21 | Pro or substitute | Documented utility adaptation | New Information |
| 22 | Synthetic | Playing against a force buy | Economy/Risk |
| 23 | Synthetic | Overtime economy allocation | Economy/Risk |
| 24 | Synthetic | Late-clock route timing | New Information |
| 25 | Synthetic | Flash versus smoke conservation | New Information |
| 26 | Synthetic | Retake role assignment | New Information |
| 27 | Pro or substitute | Documented timeout adjustment | New Information |
| 28 | Synthetic | Man-disadvantage volatility | New Information |
| 29 | Pro or substitute | Documented clutch decision | New Information |
| 30 | Pro or substitute | Multi-signal capstone | New Information |

Target composition: 24 synthetic and up to 6 source-gated professional; 15 T and 15 CT perspectives; approximately 8 Economy/Risk and 22 New Information follow-ups; 8 Guided and 22 Standard presentations; up to 6 Standard cases may carry an internal `advanced_terminology` editorial tag, which is not a player-facing difficulty mode or separate edition.

---

## 17. Monetization strategy

### Free core

Keep Today and its complete debrief free. Paywalling the explanation would break the product promise and weaken sharing/acquisition.

### Likely first paid value

- Full archive beyond a recent free window.
- Category-based practice and mistake review.
- Structured learning tracks.
- Advanced progress and confidence analysis.
- Expert commentary packs.
- Cross-device history and private groups as part of broader premium value.

### Later paths

- Coach/team case packs.
- Licensed historical collections.
- Tournament-sponsored cases with clear editorial separation.
- Creator collaborations.
- Event-specific archives.
- Fixed-budget personalized AI coaching.

Avoid:

- intrusive ads during play;
- selling streak protection;
- pay-to-rank systems;
- unlimited AI promises;
- any paid feature whose existence depends on unlicensed data.

Before charging for professional-derived content, obtain written rights covering derivative games, subscriptions/ads/sponsorship, archive, worldwide display, private raw storage, subprocessors, and post-termination treatment.

---

## 18. Validation plan and launch gates

### Gate 0 — rights route, now

Before later architecture/implementation is locked:

- apply to GRID Open Access;
- send a written public/commercial-use inquiry;
- contact at least one tournament organizer or data rights holder;
- obtain explicit answers about derivative puzzles, archive, monetization, cloud processing, and termination.

If no credible route emerges, professional cases remain an optional later module and the synthetic MVP proceeds with sourced professional context only where isolated facts are cleared. “Decision Lab” and “Pro Lens” are descriptive phrases, not product names.

### Gate 1 — core mechanic

Test at least 12 cases with at least 25 target users. This is exploratory formative research, not a public-launch retention proof.

In the same formative round, compare two accurate, unbranded descriptions with the same target players: **“synthetic decision lab with expert-reviewed analysis”** versus **“rights-cleared professional round review.”** Record comprehension, credibility, start intent, weekly-return intent, and what users believe the content contains. This is directional because of the small sample. Public acquisition copy must use the synthetic framing unless the 12-case rights-cleared professional inventory and repeatable-pipeline gate in Section 16 has passed.

Initial hypotheses:

- at least 60% of qualified visitors start;
- at least 70% of starters complete;
- at least 70% of interviewed target users say they would play weekly;
- at least 50% voluntarily play a second available prototype;
- at least 20% return within seven days without prizes;
- users describe it as more than “a CS quiz.”

### Gate 2 — fairness

- Audit at least 12 scored cases with at least 25 completed official attempts per case and at least 300 completed official attempts in total.
- Every scored case has two independent reviews and adjudication.
- Cases with irreducible ambiguity rewritten or rejected.
- Structured fairness reports are one submitted report category per attempt; the rate is submitted report categories divided by completed official attempts. Every report is triaged, and a validated P1 requires human adjudication against the disclosed state and rubric.
- Player fairness-report rate stays below 8% and validated P1 material-scoring rate stays below 2%, each using completed official attempts as denominator and reporting numerator, denominator, and 95% confidence interval.
- Every reviewer-supported action + qualifier pair in the audited sample is accepted and its final Q is within five points of that reviewer's proposed Q; any exception is corrected or the case is removed before the gate passes.
- At least 80% of a minimum 30 moderated debrief participants can accurately state why their line received its band.

### Gate 3 — professional-case feasibility

Using legally permitted data, test ten demos or equivalent match datasets.

Pass when:

- at least one publishable candidate per two source matches/demos;
- median end-to-end labor at or below 14 hours per publishable professional case and 90th percentile at or below 18 hours, including source acquisition, reconstruction, all reviews, and final approval; one-time contract negotiation is reported separately, never omitted from the business case;
- all decisive visibility/audio/comms items are verified or excluded from scoring;
- no broadcast footage is required;
- written usage basis covers the intended prototype.

If it fails, keep synthetic cases as the flagship and use factual Pro Lens context only.

### Gate 4 — content sustainability

Run the four-week production simulation in Section 16. Do not replace failure with low-quality AI volume.

### Gate 5 — retention

Run at least a four-week time-based beta with at least 300 qualified target-audience anonymous IDs and at least six released editions. Pass when:

- at least 60% of first Today loads per qualified anonymous token per edition create an attempt;
- at least 70% of attempts reach server-acknowledged completion;
- after at least 100 first-time official completers, at least 25% complete a second edition within seven 24-hour periods;
- at least 20% of qualified IDs whose first official completion is followed by two fully observed beta releases complete at least two of that three-edition window;
- before full public daily cadence, a limited 14-day daily-cadence beta must show at least 15% of qualified IDs with a fully observed seven-edition window completing at least four of those seven;
- at least 65% of `decision_complete` attempts become `debrief_complete` by reaching the final transferable-principle step;
- fewer than 8% of completed attempts file any fairness/missing-line report and fewer than 2% file a validated P1 report;
- at least 60% of a minimum 100 follow-up survey respondents name the deep case/debrief as a primary reason to return.

A qualified beta user reports playing Counter-Strike in the last 30 days and either following professional CS or actively trying to improve. “Start” means an attempt is issued; `decision_complete` means both commits are acknowledged; `debrief_complete` means the final principle step is reached. Practice attempts are excluded. Every rate reports its numerator, denominator, cohort window, and 95% confidence interval; no threshold is evaluated below its stated minimum sample. The product owner signs off on retention; the editorial lead signs off on fairness.

### Gate 6 — public daily

Meet inventory/buffer requirements in Section 16, status/correction rules in Sections 6 and 9, content/governance requirements in Section 11, rights requirements in Section 12, security/privacy requirements in Section 14, and test requirements in Section 20. No unresolved P0 or P1 finding may remain.

### Gate 7 — monetization

- Any professional content included in the paid offer has commercially sufficient written terms; a synthetic-only paid offer is not blocked by absent professional-data rights.
- Paid value does not remove Today's full learning loop.
- Content margins remain viable at measured production and licensing cost.
- AI cost ceilings and fallback are proven before any AI-based paid promise.

First proposed willingness-to-pay experiment: offer a US$4.99/month-equivalent localized plan to engaged V1.1 users for extended archive, structured practice, and durable sync. Do not treat the result as evidence before at least 2,000 randomized eligible users have seen the offer; report conversion with a 95% confidence interval. An initial signal is at least 3% conversion and at least 70% three-month contribution margin, while Today's completion rate does not fall by more than 5 percentage points in the test cohort.

For that margin calculation, attributable cost includes payment fees and refunds, hosting/CDN/database/analytics, AI inference, support, reviewer/editorial labor, data licensing, and recurring legal/compliance cost allocated to the paid cohort. Fixed historical product-development spend may be reported separately but cannot be hidden when presenting overall business viability.

### Finding severity used by the gates

- **P0:** answer/future-content leak, exploitable score authority, rights/privacy breach, or objective rules error that invalidates the edition. Blocks release immediately.
- **P1:** omitted defensible line, materially wrong scoring/reveal, inaccessible core completion, or persistent failure affecting a meaningful cohort. Blocks public launch until fixed or the case is removed.
- **P2:** significant clarity, polish, or operational weakness with a safe workaround. Fix when worthwhile before launch.
- **P3:** minor improvement or future optimization.

---

## 19. Risks and predetermined pivots

| Risk | Early signal | Response |
|---|---|---|
| Tactical grading feels subjective | Missing-line/fairness reports exceed 8%; expert split remains unstable | Rewrite/reject cases; broaden accepted bands; publish debates unscored |
| Synthetic cases become repetitive | Similarity signatures and explanations repeat | Reduce cadence; retire templates; require new cognitive tensions |
| Daily content operation is uneconomic | Mature synthetic median >7 h or weekly load >65 h without buffer growth | Remain 3–5 cases/week; invest only after retention proof |
| Professional rights remain unclear | No written archive/commercial permission | Do not promise recurring real-round cases; use synthetic + sourced context |
| Professional pipeline is too slow | Median >14 h/case, p90 >18 h, or <1 publishable candidate per 2 demos | Keep professional content occasional; negotiate better data or pivot mix |
| Product is too advanced | Briefing abandonment or glossary dependence is high | Improve progressive disclosure and Guided mode; do not split daily audience |
| Product becomes too casual | Users recall trivia, not decisions or principles | Keep tactical consequence and debrief as the spine |
| AI feels unfair | Parser disagreement/false confidence exceeds thresholds | Keep AI in shadow/unscored mode or remove it |
| Broader puzzle demand dominates | Embedded puzzle engagement is materially higher and deep-case retention weak | Test a C/D hybrid: three deep cases plus four lighter puzzle days |
| Patch invalidates inventory | Scheduled cases fail revalidation | Activate evergreen substitutes; visibly version archives |
| Abuse increases after prizes/ranking | Multi-attempt/bot anomalies | Do not launch prizes/ranking without accounts and stronger controls |

### Explicit C-to-D pivot

If, after the 60-day content experiment:

- the team cannot sustain fair deep cases;
- professional rights remain non-repeatable; or
- users consistently prefer embedded puzzle interactions to tactical judgment,

test a hybrid schedule of **three deep cases and four lighter CS puzzle days per week**. Do not launch a miscellaneous arcade before those signals exist.

---

## 20. Test and acceptance requirements carried into later phases

This PRD does not authorize implementation, but later phases must verify:

### Deterministic game logic

- all weights total exactly 100;
- every valid case-whitelisted answer combination has a golden result, plus invalid-combination rejection fixtures;
- all ten visible evidence pairs are accepted for every action and every one of the 30–50 E cells is covered;
- every finite New Information response and every valid Economy/Risk posture + priority pair has an integer F fixture from 0–100;
- aliases grade identically;
- input order and retries do not change results;
- hard caps always apply;
- lowest applicable cap wins before nearest-integer, half-up rounding;
- Q, E, and F fixtures reproduce the published 50/20/30 score exactly;
- optional prose/provider/model cannot change MVP scores;
- equivalent partial orders score equally;
- economic packages reconcile exactly;
- counterfactual changes only its declared variable;
- changing canonical/hidden outcome without changing player-visible state or rubric cannot change score;
- every rejection has a player-visible factual/rubric reason.

### Security/integrity

- no answer/rubric/future fields in any pre-commit HTML, serialized state, bundle, source map, cache, prefetch, metadata, predictable asset URL, or API response;
- no unpublished case enumeration;
- device clock has no authority;
- forged scores/illegal transitions rejected;
- repeated/concurrent submission idempotent;
- lost-response retry restores the same result;
- user/model text cannot execute markup;
- share output is spoiler-free;
- MVP Web Share/copy payload contains text only and no result URL or answer-bearing metadata;
- correction/withdrawal preserves participation;
- logs contain no future answers or unnecessary personal data.

### UX/accessibility

- no horizontal mobile overflow;
- no required typing, hover, drag, or pixel precision;
- text equivalent matches diagram information;
- full keyboard completion;
- focus and announcements work across commits/reveals;
- reduced motion removes movement-dependent communication;
- server failure never consumes an attempt;
- reset-mid-case and offline recovery behave as specified.
- WCAG 2.2 AA checks and the browser/assistive-technology matrix in Section 8 pass.

### Content

- mechanical state validation;
- independent alternative-line review;
- patch and source versioning;
- source/rights status green;
- no unlicensed media;
- correction drill;
- scenario similarity review;
- protected future inventory.

---

## 21. Decisions proposed for approval

Approve the following as Phase 1 product locks:

1. Direction C launches as one deep analysis-desk case; Direction D remains the expansion path.
2. Primary audience is active players who follow pro CS; improvement-minded players are secondary.
3. Session target is one untimed, measured 5–8 minute case with one main call and one follow-up.
4. Official score is deterministic: 50 main call/execution, 20 evidence, 30 follow-up; confidence is separate.
5. Multiple defensible lines are first-class; context-sensitive cases are rewritten or unscored.
6. MVP uses synthetic original cases and original schematics.
7. Professional reconstructions require documented rights; GRID is a prototype lead, not an assumed commercial foundation.
8. No HLTV scraping, copied broadcast/game assets, or unlicensed demo ingestion.
9. AI is optional interpretation/coaching, never the tactical authority. V1.1 shadow mode begins only after structured-loop retention and user-demand gates pass.
10. No login, global leaderboard, response timer, prizes, or paid features in MVP.
11. Reset is 00:00 UTC with a locked 12-hour beta grace for an attempt issued before reset.
12. Primary participation target is 2-of-3 released editions in closed beta and 4-of-7 after daily cadence; consecutive-edition streak is secondary and appears only at daily cadence.
13. Closed beta starts at three cases/week. Public daily launch is gated by a four-week production simulation and 21-day buffer.
14. Today and its complete debrief remain free; later monetization sells archive depth, practice, progress, and personalization.
15. If the deep-case/rights pipeline fails, test a measured C/D hybrid rather than filling the calendar with weak AI content.

### User decisions still needed before Phase 2

If the product locks above are approved, the only material choices to settle before design exploration are:

- Accept the 50/20/30 official-score weighting for beta testing.
- Confirm that public “daily” is conditional, while closed beta begins at three cases/week.
- Confirm that AI free-text understanding may wait until V1.1 shadow mode.
- Identify how credible tactical reviewers will be recruited or compensated; model consensus cannot replace them.

---

## 22. Research register

Accessed 29 August 2026 unless noted.

### Data, factual, and asset sources

- [GRID Open Access](https://grid.gg/open-access/)
- [GRID access plans](https://grid.gg/get-access/)
- [GRID linked Open Platform agreement, April 2022](https://cdn.grid.gg/gridgg/GRID_Open_Data_Platform_Agreement_05.04.2022.pdf)
- [PandaScore pricing](https://www.pandascore.co/pricing)
- [PandaScore terms](https://www.pandascore.co/terms-and-condition)
- [HLTV terms](https://www.hltv.org/terms)
- [Liquipedia API terms](https://liquipedia.net/api-terms-of-use)
- [Wikidata licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)
- [Steam Subscriber Agreement](https://checkout.steampowered.com/checkout/ssapopup)
- [Valve Video Policy](https://store.steampowered.com/video_policy)
- [Official CS2 announcements/patch notes](https://steamcommunity.com/app/730/allnews/)
- [Valve Regional Standings repository](https://github.com/ValveSoftware/counter-strike_regional_standings)
- [Valve tournament rules repository](https://github.com/ValveSoftware/counter-strike_rules_and_regs)
- [ESIC sanction outcomes](https://esic.gg/news/sanction-outcomes/)

### AI and evaluation

- [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cloudflare Workers AI data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/)
- [Workers AI JSON Mode](https://developers.cloudflare.com/workers-ai/features/json-mode/)
- [Cloudflare Gemma 4 26B A4B model page](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/)
- [Workers AI planned model deprecations](https://developers.cloudflare.com/changelog/post/2026-05-08-planned-model-deprecations/)
- [Cloudflare AI Gateway logging](https://developers.cloudflare.com/ai-gateway/observability/logging/)
- [Cloudflare AI Gateway fallbacks](https://developers.cloudflare.com/ai-gateway/configuration/fallbacks/)
- [Google Gemma 4 announcement and Apache 2.0 license statement](https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/)
- [Judging the Judges: position bias in LLM-as-a-Judge](https://arxiv.org/abs/2406.07791)
- [Evaluating Scoring Bias in LLM-as-a-Judge](https://arxiv.org/abs/2506.22316)
- [Grading Scale Impact on LLM-as-a-Judge](https://arxiv.org/abs/2601.03444)

---

## 23. Phase boundary

This document ends Phase 1.

No repository, production code, final visual direction, Cloudflare resource, data contract, or public product name should be created until the user approves or revises these product decisions. On approval, Phase 2 should produce three materially different design directions for this exact product and stop again for selection.
