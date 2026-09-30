"""The follow-up: the first thing after the decision that materially changes what the team knows.

Scans 3-25 s after the decision. Each candidate moment is judged on the
knowledge view AT that moment (never on later frames), so the follow-up text
and `knowledgeAfter` contain only information the team could have had by then.
"""

from __future__ import annotations

from typing import Any

from ..model import FollowUp, KnowledgeView
from .common import (
    dist2d,
    indefinite,
    kill_events,
    number_word,
    other_side,
    players_at,
    plural,
    pretty_place,
    seconds_to_ticks,
    side_word,
    tick_t,
)
from .knowledge import OBSERVE_RADIUS, knowledge_view, new_facts

FOLLOWUP_MIN_S = 3.0
FOLLOWUP_MAX_S = 25.0
DEFUSE_HEARD_RADIUS = 1200  # a T this close to the bomb hears a defuse start
STATIONARY_ENEMY_UNITS = 300  # newly spotted enemies that moved less than this were already there


def find_followup(match: dict[str, Any], round_: dict[str, Any], decision_tick: int, perspective: str) -> FollowUp | None:
    lo = decision_tick + seconds_to_ticks(match, FOLLOWUP_MIN_S)
    hi = decision_tick + seconds_to_ticks(match, FOLLOWUP_MAX_S)
    before_view = knowledge_view(match, round_, decision_tick, perspective)

    # Moments worth checking: every frame and every event in the window.
    moments = sorted(
        {frame["tick"] for frame in round_["frames"] if lo <= frame["tick"] <= hi}
        | {event["tick"] for event in round_["events"] if lo <= event["tick"] <= hi}
    )
    # Baseline for "newly": the last moment before the window opens, so information that arrived in the
    # first seconds after the decision is not reported as if it arrived later.
    if _own_action_between(round_, decision_tick, lo, perspective):
        # The deciding team already acted (kill, plant, defuse) before the window opened, so anything
        # learned afterwards sits on top of the historical line.
        return None
    earlier = [frame["tick"] for frame in round_["frames"] if decision_tick < frame["tick"] < lo]
    previous = knowledge_view(match, round_, earlier[-1], perspective) if earlier else before_view
    for tick in moments:
        view = knowledge_view(match, round_, tick, perspective)
        change = _material_change(match, round_, tick, perspective, previous, view, before_view)
        if change == OWN_ACTION:
            # The first material change was caused by the deciding team itself (its own kill, plant or
            # defuse). That is the historical line playing out, not independent news: using it, or any
            # later change built on top of it, would contradict a player who chose differently.
            return None
        if change is not None:
            kind, summary = change
            return {
                "tick": tick,
                "t": tick_t(match, round_, tick),
                "kind": kind,
                "summary": summary,
                "newFacts": new_facts(before_view, view),
                "knowledgeAfter": view,
                "dependsOnOwnMovement": _depends_on_own_movement(round_, decision_tick, tick, kind, previous, view, before_view, perspective),
                "reactionWindowSeconds": _reaction_window(match, round_, tick),
            }
        previous = view
    return None


OWN_ACTION = ("own_action", "")


def _material_change(
    match: dict[str, Any],
    round_: dict[str, Any],
    tick: int,
    perspective: str,
    previous: KnowledgeView,
    view: KnowledgeView,
    decision_view: KnowledgeView,
) -> tuple[str, str] | None:
    enemy_side = other_side(perspective)
    enemy_noun = side_word(enemy_side)
    enemy_singular = side_word(enemy_side, plural=False)

    # 1. Kills (the kill feed shows every kill to both teams).
    kills = [e for e in kill_events(round_) if e["tick"] == tick and e["data"].get("weapon") != "planted_c4"]
    if kills:
        enemy_dead = sum(1 for e in kills if e["data"].get("victimSide") == enemy_side)
        own_dead = sum(1 for e in kills if e["data"].get("victimSide") == perspective)
        left = view["alive"]["enemy"]
        if enemy_dead:
            # Any enemy death here is a kill by the deciding team (or a trade it took part in).
            return OWN_ACTION
        who = "One of your players is killed" if own_dead == 1 else f"{number_word(own_dead, capitalise=True)} of your players are killed"
        return "kill", f"{who}; {view['alive']['own']} of your team left."

    # 2. Bomb events as known to this side.
    for event in round_["events"]:
        if event["tick"] != tick:
            continue
        data = event["data"]
        if event["type"] == "bomb_planted":
            if perspective == "T":
                return OWN_ACTION
            site = data.get("site")
            where = f"at {site}" if site else f"in {pretty_place(data.get('place'))}"
            return "bomb_planted", f"The bomb is planted {where}."
        if event["type"] == "bomb_defuse_begin":
            if perspective == "CT":
                return OWN_ACTION
            heard = perspective == "CT" or _own_player_near(round_, tick, perspective, data)
            if heard:
                site = data.get("site")
                where = f"at {site}" if site else f"in {pretty_place(data.get('place'))}"
                return "defuse_started", f"A defuse begins {where}."

    # 3. An enemy newly confirmed (was unknown/last_seen, or not confirmed a moment ago).
    newly = _newly_confirmed(previous, view, decision_view)
    if newly:
        places: dict[str | None, int] = {}
        for enemy in newly:
            places[enemy.get("place")] = places.get(enemy.get("place"), 0) + 1
        total = sum(places.values())
        ordered = sorted(places.items(), key=lambda item: (item[0] is None, item[0] or ""))
        if len(ordered) == 1:
            place = ordered[0][0]
            if total == 1:
                if newly[0].get("pid") and newly[0].get("pid") == (view.get("bomb") or {}).get("carrierPid"):
                    return "enemy_spotted", f"The bomb carrier appears in {pretty_place(place)}."
                return "enemy_spotted", f"{indefinite(enemy_singular)} appears in {pretty_place(place)}."
            return "enemy_spotted", f"{number_word(total, capitalise=True)} {enemy_noun} appear in {pretty_place(place)}."
        listing = ", ".join(f"{number_word(n)} in {pretty_place(place)}" for place, n in ordered)
        return "enemy_spotted", f"{number_word(total, capitalise=True)} {enemy_noun} appear: {listing}."

    # 4. Observed enemy utility that was not visible before.
    fresh = _fresh_utility(perspective, previous, view, decision_view)
    if fresh:
        kind, place, _, _ = fresh[0]
        return "utility_seen", f"The {enemy_noun} detonate a {kind} in {pretty_place(place)}."
    return None


def _newly_confirmed(previous: KnowledgeView, view: KnowledgeView, decision_view: KnowledgeView) -> list[Any]:
    before_status = {e["pid"]: e["status"] for e in previous["enemies"]}
    newly = [e for e in view["enemies"] if e["status"] == "confirmed" and before_status.get(e["pid"]) != "confirmed"]
    if newly:
        # An enemy who was confirmed at the decision and simply stays put is not news.
        decision_confirmed = {e["pid"]: e.get("place") for e in decision_view["enemies"] if e["status"] == "confirmed"}
        newly = [e for e in newly if decision_confirmed.get(e["pid"], "\0") != e.get("place")]
    return newly


def _fresh_utility(perspective: str, previous: KnowledgeView, view: KnowledgeView, decision_view: KnowledgeView) -> list[tuple[str, str | None, int, int]]:
    def keyset(v: KnowledgeView) -> set[tuple[str, str | None, int, int]]:
        return {(u["kind"], u["place"], u["x"], u["y"]) for u in v["utilityObserved"] if u["side"] != perspective}

    fresh = keyset(view) - keyset(decision_view) - keyset(previous)
    return sorted(fresh, key=lambda item: (item[0], item[1] or "", item[2], item[3]))


def _depends_on_own_movement(
    round_: dict[str, Any],
    decision_tick: int,
    tick: int,
    kind: str,
    previous: KnowledgeView,
    view: KnowledgeView,
    decision_view: KnowledgeView,
    perspective: str,
) -> bool:
    """True when the follow-up only exists because the deciding team moved.

    enemy_spotted: every newly spotted enemy stayed within STATIONARY_ENEMY_UNITS of where he stood at the
    decision tick, i.e. he was already there and the team merely walked into view of him.
    utility_seen: no own player standing at the decision tick was within OBSERVE_RADIUS of the detonation,
    so a team that had not moved would not have observed it."""
    if kind == "enemy_spotted":
        newly = {e["pid"] for e in _newly_confirmed(previous, view, decision_view)}
        _, then = players_at(round_, decision_tick)
        _, now = players_at(round_, tick)
        start = {p["pid"]: p for p in then}
        end = {p["pid"]: p for p in now}
        pids = [pid for pid in newly if pid in start and pid in end]
        return bool(pids) and len(pids) == len(newly) and all(
            dist2d(start[pid]["x"], start[pid]["y"], end[pid]["x"], end[pid]["y"]) < STATIONARY_ENEMY_UNITS for pid in pids
        )
    if kind == "utility_seen":
        fresh = _fresh_utility(perspective, previous, view, decision_view)
        if not fresh:
            return False
        _, _, x, y = fresh[0]
        return not any(dist2d(p["x"], p["y"], x, y) <= OBSERVE_RADIUS for p in decision_view["own"])
    return False


def _reaction_window(match: dict[str, Any], round_: dict[str, Any], tick: int) -> float | None:
    """Seconds from the follow-up tick to the next player kill of the round (the bomb's own kills excluded)."""
    later = [e["tick"] for e in kill_events(round_) if e["tick"] > tick and e["data"].get("weapon") != "planted_c4"]
    return round((min(later) - tick) / match["tickrate"], 2) if later else None


def _own_action_between(round_: dict[str, Any], start_tick: int, end_tick: int, perspective: str) -> bool:
    enemy_side = other_side(perspective)
    for event in round_["events"]:
        if not start_tick < event["tick"] < end_tick:
            continue
        data = event["data"]
        if event["type"] == "kill" and data.get("victimSide") == enemy_side and data.get("weapon") != "planted_c4":
            return True
        if event["type"] == "bomb_planted" and perspective == "T":
            return True
        if event["type"] == "bomb_defuse_begin" and perspective == "CT":
            return True
    return False


def _own_player_near(round_: dict[str, Any], tick: int, perspective: str, data: dict[str, Any]) -> bool:
    if data.get("x") is None:
        return False
    _, players = players_at(round_, tick)
    return any(p["alive"] and p["side"] == perspective and dist2d(p["x"], p["y"], data["x"], data["y"]) <= DEFUSE_HEARD_RADIUS for p in players)

