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
from .knowledge import knowledge_view, new_facts

FOLLOWUP_MIN_S = 3.0
FOLLOWUP_MAX_S = 25.0
DEFUSE_HEARD_RADIUS = 1200  # a T this close to the bomb hears a defuse start


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
    earlier = [frame["tick"] for frame in round_["frames"] if decision_tick < frame["tick"] < lo]
    previous = knowledge_view(match, round_, earlier[-1], perspective) if earlier else before_view
    for tick in moments:
        view = knowledge_view(match, round_, tick, perspective)
        change = _material_change(match, round_, tick, perspective, previous, view, before_view)
        if change is not None:
            kind, summary = change
            return {
                "tick": tick,
                "t": tick_t(match, round_, tick),
                "kind": kind,
                "summary": summary,
                "newFacts": new_facts(before_view, view),
                "knowledgeAfter": view,
            }
        previous = view
    return None


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
        if enemy_dead and not own_dead:
            who = f"{indefinite(enemy_singular)} is killed" if enemy_dead == 1 else f"{number_word(enemy_dead, capitalise=True)} {enemy_noun} are killed"
            return "kill", f"{who}; {plural(left, enemy_singular)} left."
        if own_dead and not enemy_dead:
            who = "One of your players is killed" if own_dead == 1 else f"{number_word(own_dead, capitalise=True)} of your players are killed"
            return "kill", f"{who}; {view['alive']['own']} of your team left."
        return "kill", f"Players fall on both sides; {view['alive']['own']} of your team and {left} {enemy_noun} remain."

    # 2. Bomb events as known to this side.
    for event in round_["events"]:
        if event["tick"] != tick:
            continue
        data = event["data"]
        if event["type"] == "bomb_planted":
            site = data.get("site")
            where = f"at {site}" if site else f"in {pretty_place(data.get('place'))}"
            return "bomb_planted", f"The bomb is planted {where}."
        if event["type"] == "bomb_defuse_begin":
            heard = perspective == "CT" or _own_player_near(round_, tick, perspective, data)
            if heard:
                site = data.get("site")
                where = f"at {site}" if site else f"in {pretty_place(data.get('place'))}"
                return "defuse_started", f"A defuse begins {where}."

    # 3. An enemy newly confirmed (was unknown/last_seen, or not confirmed a moment ago).
    before_status = {e["pid"]: e["status"] for e in previous["enemies"]}
    newly = [e for e in view["enemies"] if e["status"] == "confirmed" and before_status.get(e["pid"]) != "confirmed"]
    if newly:
        # An enemy who was confirmed at the decision and simply stays put is not news.
        decision_confirmed = {e["pid"]: e.get("place") for e in decision_view["enemies"] if e["status"] == "confirmed"}
        newly = [e for e in newly if decision_confirmed.get(e["pid"], "\0") != e.get("place")]
    if newly:
        places: dict[str | None, int] = {}
        for enemy in newly:
            places[enemy.get("place")] = places.get(enemy.get("place"), 0) + 1
        total = sum(places.values())
        ordered = sorted(places.items(), key=lambda item: (item[0] is None, item[0] or ""))
        if len(ordered) == 1:
            place = ordered[0][0]
            if total == 1:
                return "enemy_spotted", f"{indefinite(enemy_singular)} appears in {pretty_place(place)}."
            return "enemy_spotted", f"{number_word(total, capitalise=True)} {enemy_noun} appear in {pretty_place(place)}."
        listing = ", ".join(f"{number_word(n)} in {pretty_place(place)}" for place, n in ordered)
        return "enemy_spotted", f"{number_word(total, capitalise=True)} {enemy_noun} appear: {listing}."

    # 4. Observed enemy utility that was not visible before.
    def keyset(v: KnowledgeView) -> set[tuple[str, str | None, int, int]]:
        return {(u["kind"], u["place"], u["x"], u["y"]) for u in v["utilityObserved"] if u["side"] != perspective}

    fresh = keyset(view) - keyset(decision_view) - keyset(previous)
    if fresh:
        kind, place, _, _ = sorted(fresh, key=lambda item: (item[0], item[1] or "", item[2], item[3]))[0]
        return "utility_seen", f"The {enemy_noun} detonate a {kind} in {pretty_place(place)}."
    return None


def _own_player_near(round_: dict[str, Any], tick: int, perspective: str, data: dict[str, Any]) -> bool:
    if data.get("x") is None:
        return False
    _, players = players_at(round_, tick)
    return any(p["alive"] and p["side"] == perspective and dist2d(p["x"], p["y"], data["x"], data["y"]) <= DEFUSE_HEARD_RADIUS for p in players)

