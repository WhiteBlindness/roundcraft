"""Hand-built NormalisedMatch fixtures for the miner tests (no demo needed).

`make_round` places players statically (or via a per-player callable), applies
scripted deaths and sightings, and emits frames every 0.5 s exactly like the
real normaliser. Everything here is ground truth; the tests check what the
knowledge layer makes of it.
"""

from __future__ import annotations

from typing import Any, Callable

TICKRATE = 64
SAMPLE = 32
FREEZE_END = 1000

T_PIDS = ["p01", "p02", "p03", "p04", "p05"]
CT_PIDS = ["p06", "p07", "p08", "p09", "p10"]

# (x, y, place)
A_SITE = (1000, 1000, "BombsiteA")
PALACE = (1300, 900, "Palace")
JUNGLE = (300, 1100, "Jungle")
CONNECTOR = (-200, 800, "Connector")
MIDDLE = (-300, 0, "Middle")
CT_SPAWN = (-1500, 900, "CTSpawn")
B_SITE = (-1800, -1800, "BombsiteB")
APARTMENTS = (-1200, -1500, "Apartments")
T_SPAWN = (2000, -2000, "TSpawn")

UTIL = {"smoke": 1, "flash": 2, "he": 0, "molotov": 1, "decoy": 0}


def tick_of(t: float) -> int:
    return FREEZE_END + int(round(t * TICKRATE))


def player(pid: str, side: str, pos: tuple[int, int, str | None], *, alive: bool = True, spotted_by=(), weapon: str | None = "AK-47", has_c4: bool = False, utility: dict | None = None) -> dict[str, Any]:
    x, y, place = pos
    return {
        "pid": pid,
        "side": side,
        "alive": alive,
        "hp": 100 if alive else 0,
        "armor": 100,
        "helmet": True,
        "defuser": side == "CT",
        "x": x,
        "y": y,
        "z": 0,
        "place": place,
        "activeWeapon": weapon,
        "primary": weapon,
        "secondary": "Glock-18" if side == "T" else "USP-S",
        "utility": dict(utility if utility is not None else UTIL),
        "hasC4": has_c4,
        "money": 800,
        "equipValue": 4000,
        "spottedBy": sorted(spotted_by),
    }


def event(t: float, type_: str, **data: Any) -> dict[str, Any]:
    return {"tick": tick_of(t), "t": round(t, 2), "type": type_, "data": data}


def kill(t: float, attacker: str, victim: str, *, weapon: str = "AK-47", at: tuple[int, int, str | None] = A_SITE, sides: dict[str, str] | None = None) -> dict[str, Any]:
    sides = sides or {}
    a_side = "T" if attacker in T_PIDS else "CT"
    v_side = "T" if victim in T_PIDS else "CT"
    return event(
        t, "kill", attacker=attacker, victim=victim, assister=None, weapon=weapon, headshot=False,
        attackerSide=a_side, victimSide=v_side, attackerPlace=at[2], victimPlace=at[2],
        attackerX=at[0], attackerY=at[1], victimX=at[0], victimY=at[1],
    )


def default_positions() -> dict[str, tuple[int, int, str | None]]:
    return {
        "p01": A_SITE, "p02": PALACE, "p03": JUNGLE, "p04": CONNECTOR, "p05": MIDDLE,
        "p06": CT_SPAWN, "p07": CT_SPAWN, "p08": A_SITE, "p09": B_SITE, "p10": APARTMENTS,
    }


def make_round(
    number: int = 1,
    *,
    duration: float = 90.0,
    positions: dict[str, Any] | None = None,
    events: list[dict[str, Any]] | None = None,
    spotted: list[tuple[str, list[str], float, float]] | None = None,
    carrier: str | None = "p01",
    winner: str = "T",
    end_reason: str = "bomb_exploded",
    score_before: dict[str, int] | None = None,
    flip_sides: bool = False,
    utility: dict[str, dict] | None = None,
    weapons: dict[str, str] | None = None,
    overrides: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """`positions[pid]` is a (x, y, place) tuple or a callable t -> tuple.

    `spotted` entries are (enemy pid, [observer pids], t_from, t_to): during
    [t_from, t_to] the enemy's spottedBy contains those observers (observers who are
    dead at that frame remain in the list on purpose: the knowledge layer must
    ignore them).
    """
    positions = {**default_positions(), **(positions or {})}
    events = sorted(events or [], key=lambda e: (e["tick"], e["type"]))
    deaths = {e["data"]["victim"]: e["t"] for e in events if e["type"] == "kill"}
    plant_t = next((e["t"] for e in events if e["type"] == "bomb_planted"), None)
    frames = []
    steps = int(duration / 0.5) + 1
    for step in range(steps):
        t = round(step * 0.5, 2)
        players = []
        for pid in T_PIDS + CT_PIDS:
            side = "T" if pid in T_PIDS else "CT"
            pos = positions[pid](t) if callable(positions[pid]) else positions[pid]
            dead = pid in deaths and t >= deaths[pid]
            watchers: list[str] = []
            for enemy, observers, t0, t1 in spotted or []:
                if enemy == pid and t0 <= t <= t1:
                    watchers = list(observers)
            players.append(
                player(
                    pid, side, pos, alive=not dead, spotted_by=watchers,
                    has_c4=(pid == carrier and (plant_t is None or t < plant_t)),
                    utility=(utility or {}).get(pid),
                    weapon=(weapons or {}).get(pid, "AK-47" if side == "T" else "M4A4"),
                )
            )
        frames.append({"tick": tick_of(t), "t": t, "bombPlanted": plant_t is not None and t >= plant_t, "players": players})
    end_tick = tick_of(duration)
    for pid, changes in (overrides or {}).items():  # e.g. {"p08": {"hp": 96, "armor": 0, "secondary": None}}
        for frame in frames:
            for p in frame["players"]:
                if p["pid"] == pid and p["alive"]:
                    p.update(changes)
    if flip_sides:
        for frame in frames:
            for p in frame["players"]:
                p["side"] = "CT" if p["side"] == "T" else "T"
    return {
        "number": number,
        "freezeEndTick": FREEZE_END,
        "endTick": end_tick,
        "winner": winner,
        "endReason": end_reason,
        "scoreBefore": score_before or {"T": 0, "CT": 0},
        "roundTimeSeconds": 115.0,
        "bombTimerSeconds": 40.0,
        "frames": frames,
        "events": events,
    }


def make_match(rounds: list[dict[str, Any]], *, map_name: str = "de_mirage", sha: str = "a" * 64, source_id: str = "src_synth") -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "normaliserVersion": 1,
        "sourceId": source_id,
        "demoSha256": sha,
        "map": map_name,
        "tickrate": TICKRATE,
        "sampleEveryTicks": SAMPLE,
        "players": T_PIDS + CT_PIDS,
        "rounds": rounds,
    }


def plant_event(t: float, player_: str = "p01", site: str = "A", at=A_SITE) -> dict[str, Any]:
    return event(t, "bomb_planted", player=player_, site=site, place=at[2], x=at[0], y=at[1])


def utility_event(t: float, kind: str, thrower: str, at: tuple[int, int, str | None], **extra: Any) -> dict[str, Any]:
    side = "T" if thrower in T_PIDS else "CT"
    return event(t, "utility", kind=kind, thrower=thrower, side=side, x=at[0], y=at[1], place=at[2], **extra)


def post_plant_match() -> dict[str, Any]:
    """T plant at A at t=45; CT p07 killed at t=55; bomb explodes (T win)."""
    events = [
        plant_event(45.0),
        kill(55.0, "p02", "p07", at=A_SITE),
        event(85.0, "bomb_exploded", player=None, site="A", place="BombsiteA", x=1000, y=1000),
    ]
    spotted = [
        ("p04", ["p08"], 40.0, 41.0),  # a T in Connector is seen by CT p08 for a moment
    ]
    return make_match([make_round(1, duration=90.0, events=events, spotted=spotted, carrier="p01")])
