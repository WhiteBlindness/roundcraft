"""Deterministic heuristic priors: main matrix, evidence matrix and follow-up qualities.

Every value is derived from (situation template, player-known Features) by the rules in
templates.py; nothing here reads ground truth. Each computation records a human-readable
explanation that ends up in editorial.notes.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field, replace
from itertools import combinations
from typing import Any

from .features import Features, extract_features
from .templates import (
    available_qualifiers,
    FOLLOWUP_QUALITY,
    POOR_CAP,
    TIER_ORDER,
    TIER_RATINGS,
    URGENT_QUALITY_BEST,
    URGENT_QUALITY_OTHERS,
    ActionT,
    Situation,
)


def stable_hash(*parts: str) -> int:
    return int(hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:12], 16)


@dataclass
class QualPrior:
    id: str
    label: str
    score: int
    rank: int
    ratings: tuple[int, int]
    quality: float  # after caps
    reasons: list[str]


@dataclass
class ActionPrior:
    template: ActionT
    label: str
    tier: str
    tier_reason: str
    caps: list[int]
    cap_reasons: list[str]
    qualifiers: list[QualPrior]  # ordered by rank (best first)
    best_quality: float = 0.0


@dataclass
class MainPrior:
    actions: list[ActionPrior]  # rank order (best first)
    weights: dict[str, int]
    explain: list[str] = field(default_factory=list)
    normalised: list[str] = field(default_factory=list)


def _quality(ratings: tuple[int, int], weights: tuple[int, int], caps: list[int]) -> float:
    raw = weights[0] * ratings[0] + weights[1] * ratings[1]
    lowest = min(caps) if caps else 100
    return min(raw, lowest * 4) / 4


def action_label(action: ActionT, f: Features) -> str:
    if action.label_unplanted and f.bomb_status != "planted":
        return action.label_unplanted
    return action.label.format(place=f.place) if f.place else action.label_no_place


def offered_actions(sit: Situation, f: Features) -> list[ActionT]:
    """Template actions that apply to this state; at least three are always offered."""
    chosen = [a for a in sit.actions if a.applies is None or a.applies(f)]
    if len(chosen) < 3:
        for action in sit.actions:
            if action not in chosen:
                chosen.append(action)
            if len(chosen) >= 3:
                break
        chosen.sort(key=lambda a: sit.actions.index(a))
    return chosen[:5]


def compute_main_prior(sit: Situation, f: Features) -> MainPrior:
    weights = dict(sit.dims)
    wpair = (sit.dims[0][1], sit.dims[1][1])
    tiers: dict[str, tuple[str, str]] = {}
    offered = offered_actions(sit, f)
    for action in offered:
        tier, reason = action.default_tier, "default"
        for rule in action.tier_rules:
            if rule.test(f):
                tier, reason = rule.value, rule.text
                break
        tiers[action.id] = (tier, reason)

    normalised: list[str] = []
    if not any(tier == "best" for tier, _ in tiers.values()):
        lead = max(offered, key=lambda a: (TIER_ORDER.index(tiers[a.id][0]), -sit.actions.index(a)))
        old = tiers[lead.id][0]
        tiers[lead.id] = ("best", f"{tiers[lead.id][1]}; NORMALISED from '{old}' so at least one line reaches Best-supported")
        normalised.append(f"{lead.id}: promoted from '{old}' to 'best' (no action reached the top tier under the rules)")

    priors: list[ActionPrior] = []
    for action in offered_actions(sit, f):
        tier, tier_reason = tiers[action.id]
        caps: list[int] = []
        cap_reasons: list[str] = []
        for rule in action.cap_rules:
            if rule.test(f):
                caps.append(int(rule.value))
                cap_reasons.append(rule.text)
        if tier == "poor" and not any(c <= POOR_CAP for c in caps):
            caps.append(POOR_CAP)
            cap_reasons.append(f"cap {POOR_CAP}: poor-tier line")
        scored: list[tuple[int, int, QualPrior]] = []
        for index, qual in enumerate(available_qualifiers(action, f)):
            score, reasons = qual.base, []
            for rule in qual.rules:
                if rule.test(f):
                    score += int(rule.value)
                    reasons.append(rule.text)
            scored.append((score, index, QualPrior(qual.id, qual.label, score, 0, (0, 0), 0.0, reasons)))
        scored.sort(key=lambda item: (-item[0], item[1]))
        ladder = TIER_RATINGS[tier]
        quals: list[QualPrior] = []
        for rank, (_, _, q) in enumerate(scored):
            q.rank = rank
            q.ratings = ladder[min(rank, len(ladder) - 1)]
            q.quality = _quality(q.ratings, wpair, caps)
            quals.append(q)
        priors.append(
            ActionPrior(action, action_label(action, f), tier, tier_reason, caps, cap_reasons, quals,
                        best_quality=max(q.quality for q in quals))
        )

    priors.sort(key=lambda a: (-a.best_quality, -TIER_ORDER.index(a.tier), sit.actions.index(a.template)))
    explain = [f"features: {f.describe()}"]
    for a in priors:
        cap_text = f"; caps {a.caps} ({'; '.join(a.cap_reasons)})" if a.caps else ""
        explain.append(f"action {a.template.id} -> tier {a.tier} ({a.tier_reason}){cap_text}")
        for q in a.qualifiers:
            why = "; ".join(q.reasons) if q.reasons else "template order"
            explain.append(
                f"  qualifier {q.id}: score {q.score}, rank {q.rank + 1}, ratings {list(q.ratings)} "
                f"-> line quality {q.quality:g} ({why})"
            )
    return MainPrior(priors, weights, explain, normalised)


def order_actions(priors: list[ActionPrior], candidate_id: str) -> list[ActionPrior]:
    """Deterministic pseudo-random order; the best-supported action is never listed first."""
    ordered = sorted(priors, key=lambda a: stable_hash(candidate_id, "action", a.template.id))
    best_id = priors[0].template.id  # priors are rank-sorted best-first
    if len(ordered) > 1 and ordered[0].template.id == best_id:
        swap_with = 1 + stable_hash(candidate_id, "swap") % (len(ordered) - 1)
        ordered[0], ordered[swap_with] = ordered[swap_with], ordered[0]
    return ordered


def order_qualifiers(quals: list[QualPrior], candidate_id: str, action_id: str) -> list[QualPrior]:
    return sorted(quals, key=lambda q: stable_hash(candidate_id, "qual", action_id, q.id))


# ---------------------------------------------------------------------------
# Evidence
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Signal:
    id: str
    cls: str
    label: str
    detail: str = ""  # player-known specifics for the reveal explanation


_COUNT_WORDS = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five"}


def seen_groups(f: Features) -> list[tuple[Any, int]]:
    """Known enemy positions grouped by place, freshest first: [(freshest sighting there, how many there)]."""
    seen = sorted(
        [e for e in f.known_enemies if e.place],
        key=lambda e: (e.age if e.age is not None else 0.0, e.place or ""),
    )
    groups: list[tuple[Any, int]] = []
    for enemy in seen:
        for index, (first, count) in enumerate(groups):
            # Only sightings of the same kind and similar age merge: a fresh sighting and a 13 s old one in the
            # same place are two different pieces of evidence, not "two attackers spotted".
            same_read = first.status == enemy.status and abs((enemy.age or 0.0) - (first.age or 0.0)) <= 3.0
            if first.place == enemy.place and same_read:
                groups[index] = (first, count + 1)
                break
        else:
            groups.append((enemy, 1))
    return groups


def available_signals(sit: Situation, f: Features) -> list[Signal]:
    """Player-known signals the evidence options can be chosen from, in situation priority order."""
    noun = f.enemy_noun.capitalize()
    pool: dict[str, list[Signal]] = {}
    if f.time_kind == "bomb":
        pool["bomb_timer"] = [Signal("bomb_timer", "bomb_timer", "Bomb timer")]
    if f.time_kind == "round":
        pool["clock"] = [Signal("round_clock", "clock", "Round clock")]
    pool["alive_count"] = [Signal("alive_count", "alive_count", "Alive count")]
    pool["own_utility"] = [Signal("own_utility", "own_utility", "Own utility")]
    pool["enemy_seen"] = []
    for index, (enemy, count) in enumerate(seen_groups(f)[:2], start=1):
        verb = "spotted" if enemy.status == "confirmed" else "last seen"
        subject = noun if count == 1 else f"{_COUNT_WORDS.get(count, str(count))} {f.enemy_noun}s".capitalize()
        pool["enemy_seen"].append(Signal(f"enemy_seen_{index}", "enemy_seen", f"{subject} {verb} in {enemy.place}"))
    if f.unknown_enemies > 0:
        pool["enemy_unknown"] = [Signal("enemy_unknown", "enemy_unknown", f"Unknown {f.enemy_noun} positions")]
    if f.bomb_status == "planted" and (f.bomb_place or f.bomb_site):
        pool["bomb_location"] = [Signal("bomb_location", "bomb_location", "Bomb location")]
    if f.observed_enemy_utility:
        pool["enemy_utility"] = [Signal("enemy_utility", "enemy_utility", "Enemy utility already seen")]
    if f.perspective == "CT" and f.bomb_status == "planted":
        pool["defuse_kit"] = [Signal("defuse_kit", "defuse_kit", "Defuse kit availability")]
    pool["own_positions"] = [Signal("own_positions", "own_positions", "Own team positions")]
    pool["own_loadout"] = [Signal("own_loadout", "own_loadout", "Own weapons and armour")]

    ordered: list[Signal] = []
    for cls in list(sit.evidence_priority) + [c for c in pool if c not in sit.evidence_priority]:
        ordered.extend(pool.get(cls, []))
    if len(ordered) < 5:  # e.g. no clock in the view: fall back to generic player-known signals
        ordered.append(Signal("own_health", "own_loadout", "Own health and armour"))
        ordered.append(Signal("side_and_map", "own_positions", "Side and map"))
    return ordered


def choose_evidence(sit: Situation, f: Features) -> list[Signal]:
    signals = available_signals(sit, f)
    chosen = signals[:5]
    return chosen


def evidence_points(sit: Situation, action: ActionT, evidence: list[Signal]) -> dict[tuple[str, str], int]:
    """Points 3..20 for each of the 10 pairs, from per-signal-class relevance weights."""

    def weight(signal: Signal) -> int:
        return action.evidence_weights.get(signal.cls, sit.evidence_weights.get(signal.cls, 1))

    weights = sorted((weight(s) for s in evidence), reverse=True)
    top = weights[0] + weights[1]
    result: dict[tuple[str, str], int] = {}
    for a, b in combinations(sorted(evidence, key=lambda s: s.id), 2):
        result[(a.id, b.id)] = min(20, max(3, round(20 * (weight(a) + weight(b)) / top)))
    return result


def evidence_explain(sit: Situation, evidence: list[Signal]) -> list[str]:
    lines = []
    for s in evidence:
        base = sit.evidence_weights.get(s.cls, 1)
        lines.append(f"evidence {s.id} ({s.cls}): default weight {base}")
    return lines


# ---------------------------------------------------------------------------
# Follow-up
# ---------------------------------------------------------------------------


GENERIC_ELAPSED_SECONDS = 8


def generic_elapsed(f: Features) -> int | None:
    """Seconds the generic follow-up lets pass (None without a clock); shorter when the clock is nearly out."""
    if f.time_left is None:
        return None
    return GENERIC_ELAPSED_SECONDS if f.time_left >= 10 else max(1, int(f.time_left // 2))


def followup_class(sit: Situation, before: Features, followup: dict[str, Any] | None, candidate: dict[str, Any]) -> tuple[str, str, Features | None]:
    """Return (class, explanation, features after)."""
    if followup is None:
        elapsed = generic_elapsed(before)
        if elapsed is not None:
            later = replace(before, time_left=max(0.0, before.time - elapsed))
            if sit.urgent_test(later):
                return ("urgent", f"no follow-up was available; after {elapsed} s of the clock running down the state is urgent: "
                        f"{sit.urgent_text}", later)
        return "no_followup", "no follow-up available: conservative generic qualities", None
    after_candidate = {
        "playerKnown": followup["knowledgeAfter"],
        "perspective": candidate.get("perspective"),
        "map": candidate.get("map"),
        "category": candidate.get("category"),
    }
    after = extract_features(after_candidate)
    after.situation = sit.id
    if sit.urgent_test(after):
        return "urgent", f"urgent state: {sit.urgent_text}", after
    kind = (followup.get("kind") or "").lower()
    if "plant" in kind or "defus" in kind:
        return "bomb_event", f"follow-up kind '{kind}' changes the bomb state", after
    if any(word in kind for word in ("kill", "death", "elimin", "trade")):
        if after.enemy_alive < before.enemy_alive:
            return "enemy_loss", f"follow-up kind '{kind}': an opponent is eliminated ({before.enemy_alive}->{after.enemy_alive})", after
        if after.own_alive < before.own_alive:
            return "own_loss", f"follow-up kind '{kind}': a teammate is eliminated ({before.own_alive}->{after.own_alive})", after
        return "default", f"follow-up kind '{kind}' without a change in the alive counts", after
    if any(word in kind for word in ("spot", "seen", "sight", "sound", "heard", "utility", "position", "contact")):
        return "position_info", f"follow-up kind '{kind}' adds information about opponent position or utility", after
    return "default", f"follow-up kind '{kind}' not specifically recognised: default table", after


def followup_qualities(sit: Situation, cls: str) -> dict[str, int]:
    if cls == "urgent":
        table = dict(URGENT_QUALITY_OTHERS)
        table[sit.urgent_best] = URGENT_QUALITY_BEST
        return table
    return dict(FOLLOWUP_QUALITY[cls])


def order_responses(responses: list[Any], qualities: dict[str, int], candidate_id: str) -> list[Any]:
    ordered = sorted(responses, key=lambda r: stable_hash(candidate_id, "response", r.id))
    best_id = max(responses, key=lambda r: qualities[r.id]).id
    if len(ordered) > 1 and ordered[0].id == best_id:
        swap_with = 1 + stable_hash(candidate_id, "rswap") % (len(ordered) - 1)
        ordered[0], ordered[swap_with] = ordered[swap_with], ordered[0]
    return ordered
