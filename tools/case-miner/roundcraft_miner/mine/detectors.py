"""Decision-point detectors.

Each detector looks at the (omniscient) round and proposes moments where a
player-side team faces a real decision. Detectors only choose WHEN to ask; what
the team knew at that moment is decided later by `knowledge.knowledge_view`.

Taxonomy (see CATEGORIES). Every category is a heuristic for "there is more than
one defensible action here" and is refined against the real demos; none of them
encodes a claim about what the right action is.
"""

from __future__ import annotations

from typing import Any

from .common import (
    alive_counts,
    dist2d,
    events_of,
    kill_events,
    plant_info,
    players_at,
    seconds_to_ticks,
    site_centroids,
    snap_to_frame,
    tick_t,
    utility_total,
)
from .knowledge import knowledge_view

CATEGORIES = (
    "post_plant",
    "opening_pick",
    "man_advantage_shift",
    "late_round_no_plant",
    "rotation_read",
    "low_utility_attack",
    "economy_save",
)

POST_PLANT_DELAY_S = 4.0
OPENING_PICK_MIN_T = 5.0
KILL_DECISION_DELAY_S = 2.0
LATE_ROUND_LEFT_S = 35.0
LATE_ROUND_MIN_T_ALIVE = 2
LOW_UTILITY_MAX_ITEMS = 2
LOW_UTILITY_MIN_T_ALIVE = 3
LOW_UTILITY_CLOCK_RANGE_S = (25.0, 60.0)
ECONOMY_SAVE_MAX_ALIVE = 2
ECONOMY_SAVE_MIN_ENEMY = 3
ECONOMY_SAVE_CLOCK_S = 25.0
ROTATION_MIN_ENEMIES = 2
ROTATION_WINDOW_S = 3.0  # enemies sighted within this long ago count as "seen together"
SITE_APPROACH_RADIUS = 1500  # world units from a site centre that counts as "at the site / its approach"
CT_ELSEWHERE_RADIUS = 2200  # a CT this far from the threatened site is "elsewhere"
ROTATION_MIN_T = 10.0
DEDUPE_WINDOW_S = 5.0
MAX_PER_ROUND_PER_PERSPECTIVE = 2


def _decision(match: dict[str, Any], round_: dict[str, Any], tick: int, perspective: str, category: str, **detail: Any) -> dict[str, Any] | None:
    snapped = snap_to_frame(round_, tick)
    if snapped is None or snapped >= round_["endTick"]:
        return None
    if events_of(round_, "bomb_defused", "bomb_exploded", upto=snapped):
        return None
    _, players = players_at(round_, snapped)
    own, enemy = alive_counts(players, perspective)
    if own < 1 or enemy < 1:
        return None
    return {
        "round": round_["number"],
        "tick": snapped,
        "t": tick_t(match, round_, snapped),
        "perspective": perspective,
        "category": category,
        "detail": detail,
    }


def _frames_in(round_: dict[str, Any], lo: int, hi: int) -> list[dict[str, Any]]:
    return [f for f in round_["frames"] if lo <= f["tick"] <= hi]


def detect_post_plant(match: dict[str, Any], round_: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    for event in events_of(round_, "bomb_planted"):
        tick = event["tick"] + seconds_to_ticks(match, POST_PLANT_DELAY_S)
        for perspective in ("CT", "T"):
            found = _decision(match, round_, tick, perspective, "post_plant", site=event["data"].get("site"))
            if found:
                out.append(found)
    return out


def detect_kill_states(match: dict[str, Any], round_: dict[str, Any]) -> list[dict[str, Any]]:
    """opening_pick (first kill, not before OPENING_PICK_MIN_T) and man_advantage_shift (later kills)."""
    out = []
    kills = kill_events(round_)
    delay = seconds_to_ticks(match, KILL_DECISION_DELAY_S)
    for index, kill in enumerate(kills):
        if kill["data"].get("weapon") == "planted_c4":
            continue  # the bomb exploding is not a tactical kill
        tick = kill["tick"] + delay
        if index == 0:
            if kill["t"] < OPENING_PICK_MIN_T:
                continue
            category = "opening_pick"
        else:
            category = "man_advantage_shift"
        snapped = snap_to_frame(round_, tick)
        if snapped is None:
            continue
        _, players = players_at(round_, snapped)
        for perspective in ("T", "CT"):
            own, enemy = alive_counts(players, perspective)
            if category == "man_advantage_shift" and (own < 2 or enemy < 2):
                continue  # 1vN and Nv1 are mostly aim duels
            found = _decision(match, round_, tick, perspective, category, killTick=kill["tick"])
            if found:
                out.append(found)
    return out


def detect_late_round_no_plant(match: dict[str, Any], round_: dict[str, Any]) -> list[dict[str, Any]]:
    threshold = round_["roundTimeSeconds"] - LATE_ROUND_LEFT_S
    for frame in round_["frames"]:
        if frame["t"] < threshold:
            continue
        if plant_info(round_, frame["tick"]) is not None:
            return []
        _, players = players_at(round_, frame["tick"])
        t_alive, ct_alive = alive_counts(players, "T")
        if t_alive >= LATE_ROUND_MIN_T_ALIVE and ct_alive >= 1:
            found = _decision(match, round_, frame["tick"], "T", "late_round_no_plant")
            return [found] if found else []
        return []
    return []


def detect_low_utility_attack(match: dict[str, Any], round_: dict[str, Any]) -> list[dict[str, Any]]:
    lo_left, hi_left = LOW_UTILITY_CLOCK_RANGE_S
    for frame in round_["frames"]:
        left = round_["roundTimeSeconds"] - frame["t"]
        if not (lo_left <= left <= hi_left):
            continue
        if plant_info(round_, frame["tick"]) is not None:
            return []
        _, players = players_at(round_, frame["tick"])
        t_alive, ct_alive = alive_counts(players, "T")
        if t_alive >= LOW_UTILITY_MIN_T_ALIVE and ct_alive >= 1 and utility_total(players, "T") <= LOW_UTILITY_MAX_ITEMS:
            found = _decision(match, round_, frame["tick"], "T", "low_utility_attack")
            return [found] if found else []
    return []


def detect_economy_save(match: dict[str, Any], round_: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    done: set[str] = set()
    for frame in round_["frames"]:
        _, players = players_at(round_, frame["tick"])
        planted = plant_info(round_, frame["tick"])
        if planted is None and "T" not in done:
            left = round_["roundTimeSeconds"] - frame["t"]
            t_alive, ct_alive = alive_counts(players, "T")
            if left <= ECONOMY_SAVE_CLOCK_S and t_alive <= ECONOMY_SAVE_MAX_ALIVE and ct_alive >= ECONOMY_SAVE_MIN_ENEMY:
                done.add("T")
                found = _decision(match, round_, frame["tick"], "T", "economy_save", clock="round")
                if found:
                    out.append(found)
        if planted is not None and "CT" not in done:
            left = round_["bombTimerSeconds"] - (frame["t"] - planted["t"])
            ct_alive, t_alive = alive_counts(players, "CT")
            if 0 < left <= ECONOMY_SAVE_CLOCK_S and ct_alive <= ECONOMY_SAVE_MAX_ALIVE and t_alive >= ECONOMY_SAVE_MIN_ENEMY:
                done.add("CT")
                found = _decision(match, round_, frame["tick"], "CT", "economy_save", clock="bomb")
                if found:
                    out.append(found)
    return out


def detect_rotation_read(match: dict[str, Any], round_: dict[str, Any], centres: dict[str, tuple[float, float]]) -> list[dict[str, Any]]:
    if len(centres) < 2:
        return []
    out = []
    done_sites: set[str] = set()
    last_spot_t: float | None = None
    for frame in round_["frames"]:
        if frame["t"] < ROTATION_MIN_T:
            continue
        if plant_info(round_, frame["tick"]) is not None:
            break
        if any(p["side"] == "T" and p["alive"] and p.get("spottedBy") for p in frame["players"]):
            last_spot_t = frame["t"]
        if last_spot_t is None or frame["t"] - last_spot_t > ROTATION_WINDOW_S:
            continue
        view = knowledge_view(match, round_, frame["tick"], "CT")
        confirmed = [e for e in view["enemies"] if e["status"] != "unknown" and e["ageSeconds"] <= ROTATION_WINDOW_S]
        if len(confirmed) < ROTATION_MIN_ENEMIES:
            continue
        for site, (cx, cy) in sorted(centres.items()):
            if site in done_sites:
                continue
            others = [c for s, c in centres.items() if s != site]
            near = [
                e
                for e in confirmed
                if dist2d(e["x"], e["y"], cx, cy) <= SITE_APPROACH_RADIUS and all(dist2d(e["x"], e["y"], cx, cy) < dist2d(e["x"], e["y"], ox, oy) for ox, oy in others)
            ]
            if len(near) < ROTATION_MIN_ENEMIES:
                continue
            elsewhere = [p for p in view["own"] if dist2d(p["x"], p["y"], cx, cy) > CT_ELSEWHERE_RADIUS]
            if not elsewhere:
                continue
            found = _decision(match, round_, frame["tick"], "CT", "rotation_read", site=site, enemiesNear=len(near), ctsElsewhere=len(elsewhere))
            if found:
                done_sites.add(site)
                out.append(found)
    return out


def detect_round(match: dict[str, Any], round_: dict[str, Any], centres: dict[str, tuple[float, float]] | None = None) -> list[dict[str, Any]]:
    if not round_["frames"]:
        return []
    if centres is None:
        centres = site_centroids(match)
    found = (
        detect_post_plant(match, round_)
        + detect_kill_states(match, round_)
        + detect_late_round_no_plant(match, round_)
        + detect_low_utility_attack(match, round_)
        + detect_economy_save(match, round_)
        + detect_rotation_read(match, round_, centres)
    )
    unique: dict[tuple[int, str, str], dict[str, Any]] = {}
    for item in found:
        unique.setdefault((item["tick"], item["perspective"], item["category"]), item)
    return sorted(unique.values(), key=lambda d: (d["tick"], d["perspective"], d["category"]))


def detect_decisions(match: dict[str, Any]) -> list[dict[str, Any]]:
    centres = site_centroids(match)
    out: list[dict[str, Any]] = []
    for round_ in match["rounds"]:
        out.extend(detect_round(match, round_, centres))
    return out


def dedupe_and_cap(items: list[dict[str, Any]], *, window_s: float = DEDUPE_WINDOW_S, cap: int = MAX_PER_ROUND_PER_PERSPECTIVE) -> list[dict[str, Any]]:
    """Per (round, perspective): keep the higher score inside any `window_s` window, then at most `cap`.

    Items need `round`, `perspective`, `t`, `tick`, `category` and a numeric `score`.
    Greedy by descending score with a stable tie-break, so the result is deterministic.
    """
    ordered = sorted(items, key=lambda i: (-i["score"], i["round"], i["tick"], i["perspective"], i["category"]))
    kept: list[dict[str, Any]] = []
    for item in ordered:
        same = [k for k in kept if k["round"] == item["round"] and k["perspective"] == item["perspective"]]
        if len(same) >= cap:
            continue
        if any(abs(k["t"] - item["t"]) <= window_s for k in same):
            continue
        kept.append(item)
    return sorted(kept, key=lambda i: (i["round"], i["tick"], i["perspective"], i["category"]))
