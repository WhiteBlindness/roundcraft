"""Demo -> NormalisedMatch (anonymised ground truth).

Everything downstream (candidate mining, drafting) reads `match.json` written here,
never the demo itself. Nothing that identifies a real person is kept: players become
p01..p10 (assigned by numeric Steam ID order), and names, clan tags, server names and
chat are never read into the output.

Approximations worth knowing about (also listed in `warnings` when they occur):

* Utility `place` is the place name of the sampled alive-player position nearest (3-D)
  to the detonation point within the same round. Demos carry no place name for
  projectiles, so this is an approximation.
* Some older demos (the 2023 CS2 limited-test build) do not resolve player references
  on pawn-based game events (kills, plants, defuses ...). For those events the actor is
  reconstructed from tick data (health/inventory changes, kill distance, weapon) and the
  event is tagged `attribution: "inferred"` (unique candidate) or `"unresolved"`
  (pid left None). Events whose actor the demo supplied are tagged `"event"`.
"""

from __future__ import annotations

import bisect
from collections import Counter
from pathlib import Path
from typing import Any

from .. import paths
from ..model import (
    NORMALISER_VERSION,
    SCHEMA_VERSION,
    Event,
    Frame,
    NormalisedMatch,
    PlayerState,
    Round,
    Side,
    sha256_file,
    write_json,
)
from ..sources import manifest as manifest_mod
from .demo_info import DemoReadError, detect_tickrate
from .helpers import (
    UNITS_TO_METERS,
    distance_3d,
    is_matchable_event_weapon,
    nearest_place,
    round_end_reason,
    round_t,
    side_from_team_num,
    site_from_place,
    weapon_matches_event,
)
from .tickstore import TICK_PROPS, TickStore, build_tick_store

DEFAULT_ROUND_SECONDS = 115.0
DEFAULT_BOMB_SECONDS = 40.0
EVENT_WINDOW_BEFORE = 4
EVENT_WINDOW_AFTER = 4
# Kill-distance tolerance (metres) when reconstructing an attacker from tick data.
ATTACKER_DISTANCE_TOLERANCE_M = 1.5
DEFUSER_MAX_DISTANCE_UNITS = 250.0

_BOMB_EVENTS = {
    "bomb_pickup": "bomb_pickup",
    "bomb_dropped": "bomb_drop",
    "bomb_beginplant": "bomb_plant_begin",
    "bomb_planted": "bomb_planted",
    "bomb_begindefuse": "bomb_defuse_begin",
    "bomb_defused": "bomb_defused",
    "bomb_exploded": "bomb_exploded",
}
_UTILITY_EVENTS = {
    "smokegrenade_detonate": "smoke",
    "flashbang_detonate": "flash",
    "hegrenade_detonate": "he",
    "inferno_startburn": "molotov",
    "decoy_started": "decoy",
}
_UTILITY_EXPIRY_EVENTS = {"smoke": "smokegrenade_expired", "molotov": "inferno_expire", "decoy": "decoy_detonate"}
_EXPIRY_MAX_SECONDS = 30.0


class NormaliseError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# Small conversions
# ---------------------------------------------------------------------------


def _isnull(value: Any) -> bool:
    return value is None or value != value


def _sid(value: Any) -> str | None:
    """Steam ID column value -> canonical digit string, or None when missing."""
    if _isnull(value):
        return None
    try:
        text = str(int(float(value))) if not isinstance(value, str) else str(int(value))
    except ValueError:
        return None
    return None if text == "0" else text


def _num(value: Any, default: int = 0) -> int:
    return default if _isnull(value) else int(round(float(value)))


def _records(df, columns: list[str]) -> list[dict[str, Any]]:
    """DataFrame -> list of dicts (only the wanted columns that exist), in row order."""
    if df is None or len(df) == 0:
        return []
    have = [c for c in columns if c in df.columns]
    data = {c: df[c].tolist() for c in have}
    return [{c: data[c][i] for c in have} for i in range(len(df))]


def _event_df(parser, name: str):
    try:
        return parser.parse_event(name)
    except Exception:  # event not present in this demo
        return None


# ---------------------------------------------------------------------------
# Round segmentation
# ---------------------------------------------------------------------------


def find_rounds(
    match_start: int,
    freeze_ends: list[int],
    round_ends: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    """Pair freeze-end and round-end events into rounds of the match proper.

    A round needs a freeze_end after the previous round's end and a round_end after
    it; rounds ending during freeze time (e.g. a surrender vote before the first
    shot) have no live play and are dropped, with a warning.
    """
    warnings: list[str] = []
    rounds: list[dict[str, Any]] = []
    previous_end = match_start
    freeze_sorted = sorted(freeze_ends)
    for end in sorted(round_ends, key=lambda r: r["tick"]):
        if end["tick"] <= match_start or end.get("is_warmup_period") is True:
            continue
        candidates = [f for f in freeze_sorted if previous_end < f < end["tick"]]
        if not candidates:
            warnings.append(
                f"round ending at tick {end['tick']} (reason {end.get('reason')}) has no freeze_end "
                "(ended during freeze time); dropped"
            )
            previous_end = end["tick"]
            continue
        rounds.append({"freeze_end": candidates[-1], **end})
        previous_end = end["tick"]
    return rounds, warnings


def _sample_ticks(freeze_end: int, end: int, step: int) -> list[int]:
    ticks = list(range(freeze_end, end, step))
    ticks.append(end)
    return ticks


def _frame_candidates(s: int, freeze_end: int, end: int, is_last: bool) -> list[int]:
    if is_last:
        return [t for t in (s, s - 1, s - 2) if freeze_end <= t <= end]
    return [t for t in (s, s + 1, s + 2) if freeze_end <= t <= end]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def normalise_demo(
    demo_path: Path,
    *,
    source_id: str,
    demo_sha256: str,
    sample_every_ticks: int = 32,
    _force_infer: bool = False,
) -> NormalisedMatch:
    """Parse `demo_path` into an anonymised NormalisedMatch (see module docstring).

    `_force_infer` discards the demo's own event actors so the reconstruction path can
    be validated against demos where the truth is known (tests only).
    """
    from demoparser2 import DemoParser

    if sample_every_ticks < 1:
        raise NormaliseError("sample_every_ticks must be >= 1")
    try:
        parser = DemoParser(str(demo_path))
        header = parser.parse_header()
    except Exception as exc:
        raise DemoReadError(f"cannot read {Path(demo_path).name}: {exc}") from exc
    map_name = str(header.get("map_name") or "")
    tickrate = detect_tickrate(parser)

    warnings: list[str] = []

    # --- round skeleton ---------------------------------------------------
    begin_df = _event_df(parser, "begin_new_match")
    match_starts = [int(t) for t in begin_df["tick"]] if begin_df is not None and len(begin_df) else []
    match_start = max(match_starts) if match_starts else 0
    freeze_ends = [int(t) for t in parser.parse_event("round_freeze_end")["tick"]]
    round_end_rows = _records(
        parser.parse_event("round_end", other=["is_warmup_period"]),
        ["tick", "winner", "reason", "is_warmup_period"],
    )
    round_end_rows = [
        {
            "tick": int(r["tick"]),
            "winner": None if _isnull(r.get("winner")) else int(r["winner"]),
            "reason": None if _isnull(r.get("reason")) else int(r["reason"]),
            "is_warmup_period": bool(r.get("is_warmup_period")) if not _isnull(r.get("is_warmup_period")) else False,
        }
        for r in round_end_rows
    ]
    rounds_raw, round_warnings = find_rounds(match_start, freeze_ends, round_end_rows)
    warnings.extend(round_warnings)
    if not rounds_raw:
        raise NormaliseError("no complete rounds found in demo")

    # --- raw events (actor identity as steam-id strings, never stored) ------
    death_rows = _records(
        _event_df(parser, "player_death"),
        ["tick", "attacker_steamid", "user_steamid", "assister_steamid", "weapon", "headshot", "distance"],
    )
    bomb_rows: list[dict[str, Any]] = []
    for name in _BOMB_EVENTS:
        for r in _records(_event_df(parser, name), ["tick", "user_steamid", "site"]):
            bomb_rows.append({"name": name, **r})
    util_rows: list[dict[str, Any]] = []
    for name, kind in _UTILITY_EVENTS.items():
        for r in _records(_event_df(parser, name), ["tick", "user_steamid", "entityid", "x", "y", "z"]):
            util_rows.append({"name": name, "kind": kind, **r})
    expiry: dict[str, dict[int, list[int]]] = {}
    for kind, name in _UTILITY_EXPIRY_EVENTS.items():
        by_entity: dict[int, list[int]] = {}
        for r in _records(_event_df(parser, name), ["tick", "entityid"]):
            if not _isnull(r.get("entityid")):
                by_entity.setdefault(int(r["entityid"]), []).append(int(r["tick"]))
        expiry[kind] = {k: sorted(v) for k, v in by_entity.items()}

    # --- single tick request ----------------------------------------------
    wanted: set[int] = set()
    plans: list[tuple[int, list[tuple[int, list[int]]]]] = []
    for rr in rounds_raw:
        fe, end = rr["freeze_end"], rr["tick"]
        samples = _sample_ticks(fe, end, sample_every_ticks)
        plan = []
        for idx, s in enumerate(samples):
            cands = _frame_candidates(s, fe, end, idx == len(samples) - 1)
            wanted.update(cands)
            plan.append((s, cands))
        plans.append((rr["freeze_end"], plan))

    def in_any_round(tick: int) -> dict[str, Any] | None:
        for rr in rounds_raw:
            if rr["freeze_end"] <= tick <= rr["tick"]:
                return rr
        return None

    for r in death_rows + bomb_rows:
        if in_any_round(int(r["tick"])) is not None:
            wanted.update(range(int(r["tick"]) - EVENT_WINDOW_BEFORE, int(r["tick"]) + EVENT_WINDOW_AFTER))
    wanted = {t for t in wanted if t >= 0}

    df = parser.parse_ticks(TICK_PROPS, ticks=sorted(wanted))
    store = build_tick_store(df)
    del df
    if not store.roster:
        raise NormaliseError("tick data is empty")
    if len(store.roster) != 10:
        warnings.append(f"expected 10 players, found {len(store.roster)}")
    steam_to_pid = store.steam_to_pid

    # Thrower fallback for grenade events whose owner the demo could not resolve.
    grenade_owner = None
    if _force_infer or any(
        _sid(r.get("user_steamid")) is None for r in util_rows if r["kind"] in {"smoke", "flash", "he", "decoy"}
    ):
        grenade_owner = _grenade_owner_index(parser)

    # --- per-round assembly ------------------------------------------------
    team_of: dict[str, str] = {}
    scores = {"A": 0, "B": 0}
    out_rounds: list[Round] = []
    site_votes: dict[str, Counter] = {}
    bomb_deltas: list[float] = []
    last_state: dict[str, PlayerState] = {}
    missing_rows = 0

    for number, (rr, (fe, plan)) in enumerate(zip(rounds_raw, plans, strict=True), start=1):
        end = rr["tick"]
        frames: list[Frame] = []
        seen_ticks: set[int] = set()
        for _s, cands in plan:
            tick = store.first_available(cands)
            if tick is None or tick in seen_ticks:
                continue
            seen_ticks.add(tick)
            players = store.states[tick]
            row: list[PlayerState] = []
            absent: list[PlayerState] = []
            for pid in store.roster:
                state = players.get(pid)
                if state is None:
                    missing_rows += 1
                    prev = last_state.get(pid)
                    state = _disconnected_state(pid, prev, store.first_side.get(pid, "T"))
                    absent.append(state)
                else:
                    last_state[pid] = state
                row.append(state)
            if absent and team_of:
                # A disconnected player's side follows their team across halftime.
                absent_ids = {id(a) for a in absent}
                present_sides = {
                    team: Counter(p["side"] for p in row if id(p) not in absent_ids and team_of.get(p["pid"]) == team)
                    for team in ("A", "B")
                }
                for state in absent:
                    counter = present_sides.get(team_of.get(state["pid"], ""))
                    if counter:
                        state["side"] = counter.most_common(1)[0][0]
            frames.append(
                {
                    "tick": tick,
                    "t": round_t((tick - fe) / tickrate),
                    "bombPlanted": store.meta[tick].bomb_planted,
                    "players": row,
                }
            )
        if not frames:
            warnings.append(f"round {number}: no tick data; dropped")
            continue

        first = frames[0]["players"]
        side_of = {p["pid"]: p["side"] for p in first}
        if not team_of:
            team_of = {pid: ("A" if side == "T" else "B") for pid, side in side_of.items()}
        side_of_team: dict[str, Side] = {}
        for team in ("A", "B"):
            sides = [side_of[pid] for pid in side_of if team_of.get(pid) == team]
            side_of_team[team] = Counter(sides).most_common(1)[0][0] if sides else ("T" if team == "A" else "CT")
        score_before = {side_of_team["A"]: scores["A"], side_of_team["B"]: scores["B"]}
        score_before = {"T": score_before.get("T", 0), "CT": score_before.get("CT", 0)}
        winner = side_from_team_num(rr["winner"])
        if winner is not None:
            team = "A" if side_of_team["A"] == winner else "B"
            scores[team] += 1

        round_time = store.meta[frames[0]["tick"]].round_time
        events = _round_events(
            rr=rr,
            fe=fe,
            end=end,
            tickrate=tickrate,
            store=store,
            side_of=side_of,
            frames=frames,
            death_rows=death_rows,
            bomb_rows=bomb_rows,
            util_rows=util_rows,
            expiry=expiry,
            grenade_owner=grenade_owner,
            steam_to_pid=steam_to_pid,
            site_votes=site_votes,
            force_infer=_force_infer,
            bomb_deltas=bomb_deltas,
        )
        out_rounds.append(
            {
                "number": number,
                "freezeEndTick": fe,
                "endTick": end,
                "winner": winner,
                "endReason": round_end_reason(rr["reason"]),
                "scoreBefore": score_before,  # type: ignore[typeddict-item]
                "roundTimeSeconds": float(round_time) if round_time else DEFAULT_ROUND_SECONDS,
                "bombTimerSeconds": 0.0,  # filled below once all rounds are seen
                "frames": frames,
                "events": events,
            }
        )

    # Site id -> letter map learned across the whole match, applied to events lacking a place.
    site_letter = {
        entity: counter.most_common(1)[0][0] for entity, counter in site_votes.items() if counter
    }
    for rnd in out_rounds:
        for ev in rnd["events"]:
            d = ev["data"]
            if d.get("site") is None and d.get("_siteId") is not None:
                d["site"] = site_letter.get(d["_siteId"])
            d.pop("_siteId", None)

    bomb_timer = DEFAULT_BOMB_SECONDS
    if bomb_deltas:
        measured = sorted(bomb_deltas)[len(bomb_deltas) // 2]
        if abs(measured - DEFAULT_BOMB_SECONDS) <= 1.5:  # event ticks lag the timer by ~1 s
            bomb_timer = DEFAULT_BOMB_SECONDS
        else:
            bomb_timer = round(measured, 1)
            warnings.append(f"bomb timer measured as {bomb_timer}s (not the 40s default)")
    for rnd in out_rounds:
        rnd["bombTimerSeconds"] = bomb_timer

    if missing_rows:
        warnings.append(f"{missing_rows} player-frames had no tick row and were treated as disconnected")
    result: NormalisedMatch = {
        "schemaVersion": SCHEMA_VERSION,
        "normaliserVersion": NORMALISER_VERSION,
        "sourceId": source_id,
        "demoSha256": demo_sha256,
        "map": map_name,
        "tickrate": tickrate,
        "sampleEveryTicks": sample_every_ticks,
        "players": list(store.roster),
        "rounds": out_rounds,
    }
    if warnings:
        result["warnings"] = sorted(set(warnings))
    return result


# ---------------------------------------------------------------------------
# Frames
# ---------------------------------------------------------------------------


def _disconnected_state(pid: str, previous: PlayerState | None, fallback_side: Side) -> PlayerState:
    base = previous
    return {
        "pid": pid,
        "side": base["side"] if base else fallback_side,
        "alive": False,
        "hp": 0,
        "armor": 0,
        "helmet": False,
        "defuser": False,
        "x": base["x"] if base else 0,
        "y": base["y"] if base else 0,
        "z": base["z"] if base else 0,
        "place": base["place"] if base else None,
        "activeWeapon": None,
        "primary": None,
        "secondary": None,
        "utility": {"smoke": 0, "flash": 0, "he": 0, "molotov": 0, "decoy": 0},
        "hasC4": False,
        "money": base["money"] if base else 0,
        "equipValue": 0,
        "spottedBy": [],
    }


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


def _grenade_owner_index(parser) -> dict[int, tuple[list[int], list[str]]]:
    """entity id -> (sorted ticks, steam ids) from projectile tracking (owner is resolved there)."""
    g = parser.parse_grenades()
    index: dict[int, tuple[list[int], list[str]]] = {}
    ents = g["grenade_entity_id"].tolist()
    ticks = g["tick"].tolist()
    sids = g["steamid"].tolist()
    for e, t, s in zip(ents, ticks, sids, strict=True):
        bucket = index.setdefault(int(e), ([], []))
        bucket[0].append(int(t))
        bucket[1].append(str(int(s)))
    for e, (t_list, s_list) in index.items():
        order = sorted(range(len(t_list)), key=t_list.__getitem__)
        index[e] = ([t_list[i] for i in order], [s_list[i] for i in order])
    return index


def _owner_of_grenade(index, entity: Any, tick: int) -> str | None:
    if index is None or _isnull(entity):
        return None
    bucket = index.get(int(entity))
    if not bucket:
        return None
    t_list, s_list = bucket
    i = bisect.bisect_right(t_list, tick + 5) - 1
    if i < 0 or tick - t_list[i] > 1500:
        return None
    return s_list[i]


def _state_at(store: TickStore, tick: int | None, pid: str | None) -> PlayerState | None:
    if tick is None or pid is None:
        return None
    return store.states.get(tick, {}).get(pid)


def _round_events(
    *,
    rr: dict[str, Any],
    fe: int,
    end: int,
    tickrate: int,
    store: TickStore,
    side_of: dict[str, Side],
    frames: list[Frame],
    death_rows: list[dict[str, Any]],
    bomb_rows: list[dict[str, Any]],
    util_rows: list[dict[str, Any]],
    expiry: dict[str, dict[int, list[int]]],
    grenade_owner,
    steam_to_pid: dict[str, str],
    site_votes: dict[str, Counter],
    force_infer: bool,
    bomb_deltas: list[float],
) -> list[Event]:
    events: list[Event] = []

    def t_of(tick: int) -> float:
        return round_t((tick - fe) / tickrate)

    def pid_of(sid_value: Any) -> str | None:
        sid = _sid(sid_value)
        return steam_to_pid.get(sid) if sid else None

    # sampled positions of alive players in this round (for utility place approximation)
    points = [
        (float(p["x"]), float(p["y"]), float(p["z"]), p["place"])
        for f in frames
        for p in f["players"]
        if p["alive"]
    ]

    # ---- kills ----------------------------------------------------------
    assigned_victims: set[str] = set()
    for row in sorted((r for r in death_rows if fe <= int(r["tick"]) <= end), key=lambda r: int(r["tick"])):
        tick = int(row["tick"])
        victim = None if force_infer else pid_of(row.get("user_steamid"))
        attacker = None if force_infer else pid_of(row.get("attacker_steamid"))
        assister = None if force_infer else pid_of(row.get("assister_steamid"))
        attribution = "event"
        if victim is None:
            victim = _infer_victim(store, tick, assigned_victims)
            attribution = "inferred" if victim else "unresolved"
            if victim is not None:
                attacker = _infer_attacker(
                    store, tick, victim, row.get("weapon"), None if _isnull(row.get("distance")) else float(row["distance"])
                )
                if attacker is None:
                    attribution = "inferred_victim_only"
            assister = None
        if victim is not None:
            assigned_victims.add(victim)
        ev_tick = store.nearest(tick)
        vs = _state_at(store, ev_tick, victim)
        a_s = _state_at(store, ev_tick, attacker)
        events.append(
            {
                "tick": tick,
                "t": t_of(tick),
                "type": "kill",
                "data": {
                    "attacker": attacker,
                    "victim": victim,
                    "assister": assister,
                    "weapon": None if _isnull(row.get("weapon")) else str(row["weapon"]).removeprefix("weapon_"),
                    "headshot": bool(row.get("headshot")) if not _isnull(row.get("headshot")) else False,
                    "attackerSide": a_s["side"] if a_s else (side_of.get(attacker) if attacker else None),
                    "victimSide": vs["side"] if vs else (side_of.get(victim) if victim else None),
                    "attackerPlace": a_s["place"] if a_s else None,
                    "victimPlace": vs["place"] if vs else None,
                    "attackerX": a_s["x"] if a_s else None,
                    "attackerY": a_s["y"] if a_s else None,
                    "victimX": vs["x"] if vs else None,
                    "victimY": vs["y"] if vs else None,
                    "attribution": attribution,
                },
            }
        )

    # ---- utility ----------------------------------------------------------
    for row in util_rows:
        tick = int(row["tick"])
        if not (fe <= tick <= end):
            continue
        kind = row["kind"]
        sid = None if force_infer else _sid(row.get("user_steamid"))
        attribution = "event"
        if sid is None and kind != "molotov":
            sid = _owner_of_grenade(grenade_owner, row.get("entityid"), tick)
            attribution = "grenade_tracking" if sid else "unresolved"
        elif sid is None:
            attribution = "unresolved"
        thrower = steam_to_pid.get(sid) if sid else None
        ts = _state_at(store, store.nearest(tick), thrower)
        x = None if _isnull(row.get("x")) else _num(row["x"])
        y = None if _isnull(row.get("y")) else _num(row["y"])
        z = None if _isnull(row.get("z")) else float(row["z"])
        place = (
            nearest_place(points, float(x), float(y), z if z is not None else 0.0) if x is not None and y is not None else None
        )
        data: dict[str, Any] = {
            "kind": kind,
            "thrower": thrower,
            "side": ts["side"] if ts else (side_of.get(thrower) if thrower else None),
            "x": x,
            "y": y,
            "place": place,
            "attribution": attribution,
        }
        if kind in expiry and not _isnull(row.get("entityid")):
            data["expiresTick"] = _expiry_tick(expiry[kind], int(row["entityid"]), tick, tickrate)
        elif kind in ("smoke", "molotov"):
            data["expiresTick"] = None
        events.append({"tick": tick, "t": t_of(tick), "type": "utility", "data": data})

    # ---- bomb ---------------------------------------------------------------
    events.extend(
        _bomb_events(
            rr=rr, fe=fe, end=end, store=store, bomb_rows=bomb_rows, t_of=t_of, pid_of=pid_of,
            force_infer=force_infer, site_votes=site_votes, bomb_deltas=bomb_deltas, tickrate=tickrate,
        )
    )
    events.sort(key=lambda e: (e["tick"], e["type"], _stable_key(e["data"])))
    return events


def _stable_key(data: dict[str, Any]) -> str:
    return "|".join(f"{k}={data[k]}" for k in sorted(data))


def _expiry_tick(by_entity: dict[int, list[int]], entity: int, tick: int, tickrate: int) -> int | None:
    ticks = by_entity.get(entity)
    if not ticks:
        return None
    i = bisect.bisect_left(ticks, tick)
    if i < len(ticks) and ticks[i] - tick <= _EXPIRY_MAX_SECONDS * tickrate:
        return ticks[i]
    return None


def _infer_victim(store: TickStore, tick: int, already: set[str]) -> str | None:
    before = store.prev(tick)
    after = store.next_ge(tick)
    if before is None or after is None:
        return None
    b, a = store.states[before], store.states[after]
    candidates = [
        pid for pid, st in b.items() if st["alive"] and pid not in already and (pid not in a or not a[pid]["alive"])
    ]
    return candidates[0] if len(candidates) == 1 else None


def _infer_attacker(
    store: TickStore, tick: int, victim: str, weapon: Any, distance_m: float | None
) -> str | None:
    before = store.prev(tick)
    if before is None or victim not in store.states[before]:
        return None
    players = store.states[before]
    v = players[victim]
    weapon_s = None if _isnull(weapon) else str(weapon)
    knowable_weapon = is_matchable_event_weapon(weapon_s)
    matches = []
    for pid, st in players.items():
        if not st["alive"] or st["side"] == v["side"]:
            continue
        if knowable_weapon and not weapon_matches_event(st["activeWeapon"], weapon_s):
            continue
        if distance_m is not None:
            d = distance_3d(st["x"], st["y"], st["z"], v["x"], v["y"], v["z"]) * UNITS_TO_METERS
            if abs(d - distance_m) > ATTACKER_DISTANCE_TOLERANCE_M:
                continue
        elif not knowable_weapon:
            continue
        matches.append(pid)
    return matches[0] if len(matches) == 1 else None


def _bomb_events(
    *,
    rr: dict[str, Any],
    fe: int,
    end: int,
    store: TickStore,
    bomb_rows: list[dict[str, Any]],
    t_of,
    pid_of,
    force_infer: bool,
    site_votes: dict[str, Counter],
    bomb_deltas: list[float],
    tickrate: int,
) -> list[Event]:
    rows = sorted((r for r in bomb_rows if fe <= int(r["tick"]) <= end), key=lambda r: (int(r["tick"]), r["name"]))
    out: list[Event] = []
    plant_pid: str | None = None
    plant_pos: tuple[int, int, int] | None = None
    plant_place: str | None = None
    plant_tick: int | None = None
    begin_plant_pid: str | None = None
    for row in rows:
        name = row["name"]
        tick = int(row["tick"])
        pid = None if force_infer else pid_of(row.get("user_steamid"))
        attribution = "event"
        if pid is None:
            pid = _infer_bomb_actor(store, name, tick, plant_pid, plant_pos, begin_plant_pid)
            attribution = "inferred" if pid else "unresolved"
        st = _state_at(store, store.nearest(tick), pid)
        x = st["x"] if st else None
        y = st["y"] if st else None
        place = st["place"] if st else None
        if name == "bomb_beginplant" and pid:
            begin_plant_pid = pid
        if name == "bomb_planted":
            plant_pid = pid
            plant_tick = tick
            if st:
                plant_pos = (st["x"], st["y"], st["z"])
                plant_place = st["place"]
        if name in ("bomb_defused", "bomb_exploded") and st is None and plant_pos is not None:
            x, y, place = plant_pos[0], plant_pos[1], plant_place
        if name == "bomb_exploded" and plant_tick is not None:
            bomb_deltas.append((tick - plant_tick) / tickrate)
        site = site_from_place(place)
        site_id = None if _isnull(row.get("site")) else str(int(row["site"]))
        if name in ("bomb_planted", "bomb_beginplant") and site is not None and site_id is not None:
            site_votes.setdefault(site_id, Counter())[site] += 1
        data: dict[str, Any] = {
            "player": pid,
            "site": site,
            "place": place,
            "x": x,
            "y": y,
            "attribution": attribution,
        }
        if site is None and site_id is not None:
            data["_siteId"] = site_id
        out.append({"tick": tick, "t": t_of(tick), "type": _BOMB_EVENTS[name], "data": data})  # type: ignore[typeddict-item]
    return out


def _infer_bomb_actor(
    store: TickStore,
    name: str,
    tick: int,
    plant_pid: str | None,
    plant_pos: tuple[int, int, int] | None,
    begin_plant_pid: str | None,
) -> str | None:
    before, after = store.prev(tick), store.next_ge(tick)
    if before is None:
        return None
    b = store.states[before]
    a = store.states.get(after, {}) if after is not None else {}
    if name == "bomb_pickup":
        gainers = [pid for pid, st in a.items() if st["hasC4"] and not b.get(pid, {}).get("hasC4", False)]
        return gainers[0] if len(gainers) == 1 else None
    if name == "bomb_exploded":
        return plant_pid  # the demo attributes the explosion to the planter
    if name in ("bomb_beginplant", "bomb_dropped"):
        holders = [
            pid for pid, st in b.items()
            if st["hasC4"] and (name == "bomb_beginplant" or pid not in a or not a[pid]["hasC4"])
        ]
        return holders[0] if len(holders) == 1 else None
    if name == "bomb_planted":
        if begin_plant_pid:
            return begin_plant_pid
        holders = [pid for pid, st in b.items() if st["hasC4"] and st["side"] == "T"]
        return holders[0] if len(holders) == 1 else None
    if name in ("bomb_begindefuse", "bomb_defused") and plant_pos is not None:
        best, best_d = None, float("inf")
        for pid, st in b.items():
            if st["side"] != "CT" or not st["alive"]:
                continue
            d = distance_3d(st["x"], st["y"], st["z"], *plant_pos)
            if d < best_d:
                best, best_d = pid, d
        return best if best is not None and best_d <= DEFUSER_MAX_DISTANCE_UNITS else None
    return None


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------


def parse_source(source_id: str) -> Path:
    """Parse a registered source's demo and write data-local/parsed/<id>/match.json."""
    manifest = manifest_mod.read_manifest(source_id)
    demo_path = paths.demos_dir() / manifest["demo"]["localFilename"]
    if not demo_path.is_file():
        raise NormaliseError(f"demo file missing: {demo_path}")
    digest = sha256_file(demo_path)
    if digest != manifest["demo"]["sha256"]:
        raise NormaliseError(f"{demo_path.name} does not match the manifest sha256; refusing to parse")
    match = normalise_demo(demo_path, source_id=source_id, demo_sha256=digest)
    out = paths.parsed_dir(source_id) / "match.json"
    write_json(out, match)
    return out
