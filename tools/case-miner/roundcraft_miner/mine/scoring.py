"""Editorial-interest score for a decision candidate.

Eight factors, each 0..1, combined as a weighted mean. The score ranks
candidates for a human editor; it is not a tactical judgement and never feeds
the official Roundcraft score. Weights and category priors are module constants
so they can be tuned in one place.
"""

from __future__ import annotations

from typing import Any

from ..model import FollowUp, KnowledgeView, Score
from .common import kill_events, seconds_to_ticks

WEIGHTS: dict[str, float] = {
    "ambiguity": 0.18,
    "stakes": 0.14,
    "incompleteness": 0.14,
    "time_pressure": 0.08,
    "presentable": 0.12,
    "followup_quality": 0.16,
    "not_aim_duel": 0.10,
    "transferable": 0.08,
}

# How often a category has several defensible actions.
AMBIGUITY_PRIOR: dict[str, float] = {
    "post_plant": 0.9,
    "rotation_read": 0.9,
    "economy_save": 0.8,
    "late_round_no_plant": 0.8,
    "man_advantage_shift": 0.65,
    "low_utility_attack": 0.6,
    "opening_pick": 0.55,
}
# How well the lesson carries to other rounds and maps.
TRANSFERABLE_PRIOR: dict[str, float] = {
    "post_plant": 0.9,
    "rotation_read": 0.9,
    "economy_save": 0.85,
    "late_round_no_plant": 0.8,
    "man_advantage_shift": 0.45,
    "low_utility_attack": 0.55,
    "opening_pick": 0.4,
}
DEFAULT_PRIOR = 0.5

STAKES_EVENT_WINDOW_S = 25.0
CHAOS_WINDOW_S = 3.0
CHAOS_MAX_KILLS = 2
FOLLOWUP_IDEAL_MIN_S = 3.0
FOLLOWUP_IDEAL_MAX_S = 20.0
FOLLOWUP_SOON_S = 5.0
AIM_DUEL_NEXT_KILL_S = 2.0
KILLS_PENALTY_FACTOR = 0.4
INCOMPLETENESS_IDEAL = (0.3, 0.8)


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def relevant_clock(view: KnowledgeView) -> float | None:
    clock = view["clock"]
    return clock["bombSecondsLeft"] if clock["bombSecondsLeft"] is not None else clock["roundSecondsLeft"]


def ambiguity(category: str, view: KnowledgeView) -> float:
    gap = abs(view["alive"]["own"] - view["alive"]["enemy"])
    # A two-player advantage usually leaves one obvious line; equal or near-equal
    # numbers are where several lines stay defensible.
    balance = {0: 1.0, 1: 0.9, 2: 0.45, 3: 0.25}.get(gap, 0.15)
    return _clamp(AMBIGUITY_PRIOR.get(category, DEFAULT_PRIOR) * balance)


def stakes(match: dict[str, Any], round_: dict[str, Any], view: KnowledgeView) -> float:
    own, enemy = view["alive"]["own"], view["alive"]["enemy"]
    bomb_in_play = view["bomb"]["status"] == "planted"
    if own >= 2 and enemy >= 2:
        base = 1.0
    elif own >= 1 and enemy >= 1 and bomb_in_play:
        base = 0.7
    elif own >= 1 and enemy >= 1:
        base = 0.4
    else:
        base = 0.0
    horizon = view["tick"] + seconds_to_ticks(match, STAKES_EVENT_WINDOW_S)
    decisive = {"kill", "bomb_planted", "bomb_defuse_begin", "bomb_defused", "bomb_exploded"}
    happens = any(view["tick"] < e["tick"] <= horizon and e["type"] in decisive for e in round_["events"])
    return _clamp(base * (1.0 if happens else 0.5))


def incompleteness(view: KnowledgeView) -> float:
    enemies = view["enemies"]
    if not enemies:
        return 0.0
    not_confirmed = sum(1 for e in enemies if e["status"] != "confirmed")
    fraction = not_confirmed / len(enemies)
    lo, hi = INCOMPLETENESS_IDEAL
    if fraction <= 0:
        return 0.0
    if fraction < lo:
        return fraction / lo
    if fraction <= hi:
        return 1.0
    if fraction < 1.0:
        return (1.0 - fraction) / (1.0 - hi)
    # nothing confirmed: worthless only when nothing at all is known
    return 0.4 if any(e["status"] == "last_seen" for e in enemies) else 0.0


def time_pressure(view: KnowledgeView) -> float:
    left = relevant_clock(view)
    if left is None:
        return 0.5
    if left < 5:
        return 0.3
    if left < 10:
        return 0.3 + 0.7 * (left - 5) / 5
    if left <= 40:
        return 1.0
    if left <= 70:
        return 1.0 - 0.85 * (left - 40) / 30
    return 0.15


def kills_before(round_: dict[str, Any], match: dict[str, Any], tick: int, seconds: float) -> int:
    lo = tick - seconds_to_ticks(match, seconds)
    return sum(1 for e in kill_events(round_) if lo < e["tick"] <= tick)


def presentable(match: dict[str, Any], round_: dict[str, Any], view: KnowledgeView) -> float:
    if view["alive"]["own"] < 2:
        return 0.0
    facts_ok = min(1.0, len(view["facts"]) / 3)
    located = [p.get("place") for p in view["own"]] + [e.get("place") for e in view["enemies"] if e["status"] != "unknown"]
    places_ok = sum(1 for place in located if place) / len(located) if located else 0.0
    chaos_ok = 1.0 if kills_before(round_, match, view["tick"], CHAOS_WINDOW_S) <= CHAOS_MAX_KILLS else 0.0
    return _clamp((facts_ok + places_ok + chaos_ok) / 3)


# How much a kind of follow-up changes what the team has to think about. A kill or a
# utility sighting says less than a resolved unknown; the bomb plant is a routine
# event for the attackers who make it, and a defuse start is routine for the defenders.
_FOLLOWUP_KIND_WEIGHT = {"enemy_spotted": 1.0, "bomb_planted": 0.9, "defuse_started": 0.9, "kill": 0.75, "utility_seen": 0.5}
_OWN_ROUTINE_KINDS = {("T", "bomb_planted"): 0.7, ("CT", "defuse_started"): 0.7}


def followup_quality(match: dict[str, Any], view: KnowledgeView, followup: FollowUp | None) -> float:
    if followup is None:
        return 0.0
    delay = followup["t"] - view["t"]
    if FOLLOWUP_SOON_S <= delay <= FOLLOWUP_IDEAL_MAX_S:
        timing = 1.0
    elif FOLLOWUP_IDEAL_MIN_S <= delay < FOLLOWUP_SOON_S:
        timing = 0.85  # inside the window but almost immediate
    elif delay < FOLLOWUP_IDEAL_MIN_S:
        timing = 0.4
    else:
        timing = 0.6
    informative = [f for f in followup["newFacts"] if not f["id"].startswith("alive_")]
    if not followup["newFacts"]:
        richness = 0.3
    else:
        richness = 0.7 + 0.3 * min(1.0, len(informative) / 2)
    kind = followup["kind"]
    weight = _OWN_ROUTINE_KINDS.get((view["perspective"], kind), _FOLLOWUP_KIND_WEIGHT.get(kind, 0.6))
    return _clamp(timing * richness * weight)


def not_aim_duel(match: dict[str, Any], round_: dict[str, Any], view: KnowledgeView) -> float:
    own, enemy = view["alive"]["own"], view["alive"]["enemy"]
    if own <= 1:
        value = 0.1
    elif enemy <= 1:
        value = 0.5
    else:
        value = 1.0
    horizon = view["tick"] + seconds_to_ticks(match, AIM_DUEL_NEXT_KILL_S)
    if any(view["tick"] < e["tick"] < horizon for e in kill_events(round_)):
        value *= KILLS_PENALTY_FACTOR
    return _clamp(value)


def transferable(category: str) -> float:
    return TRANSFERABLE_PRIOR.get(category, DEFAULT_PRIOR)


def score_candidate(match: dict[str, Any], round_: dict[str, Any], category: str, view: KnowledgeView, followup: FollowUp | None) -> Score:
    factors = {
        "ambiguity": ambiguity(category, view),
        "stakes": stakes(match, round_, view),
        "incompleteness": incompleteness(view),
        "time_pressure": time_pressure(view),
        "presentable": presentable(match, round_, view),
        "followup_quality": followup_quality(match, view, followup),
        "not_aim_duel": not_aim_duel(match, round_, view),
        "transferable": transferable(category),
    }
    factors = {name: round(_clamp(value), 3) for name, value in factors.items()}
    total = sum(WEIGHTS[name] * factors[name] for name in WEIGHTS) / sum(WEIGHTS.values())
    return {"total": round(_clamp(total), 3), "factors": factors}
