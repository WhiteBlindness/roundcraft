"""Turn one big demoparser2 tick DataFrame into per-tick anonymised player states."""

from __future__ import annotations

import bisect
from dataclasses import dataclass, field
from typing import Any

from ..model import PlayerState, Side
from .helpers import (
    clean_place,
    count_utility,
    has_c4,
    primary_weapon,
    secondary_weapon,
    side_from_team_num,
)

TICK_PROPS = [
    "X",
    "Y",
    "Z",
    "health",
    "armor_value",
    "team_num",
    "is_alive",
    "last_place_name",
    "balance",
    "current_equip_value",
    "inventory",
    "has_defuser",
    "has_helmet",
    "active_weapon_name",
    "CCSPlayerPawn.m_bSpottedByMask",
    "is_bomb_planted",
    "is_warmup_period",
    "CCSGameRulesProxy.CCSGameRules.m_iRoundTime",
]
_ROUND_TIME_COL = "CCSGameRulesProxy.CCSGameRules.m_iRoundTime"
_SPOT_COL = "CCSPlayerPawn.m_bSpottedByMask"


def _i(value: Any, default: int = 0) -> int:
    try:
        if value != value:  # NaN
            return default
        return int(round(float(value)))
    except (TypeError, ValueError):
        return default


@dataclass
class TickMeta:
    bomb_planted: bool
    round_time: float | None


@dataclass
class TickStore:
    """states[tick][pid] -> PlayerState, plus sorted list of ticks that had data."""

    states: dict[int, dict[str, PlayerState]] = field(default_factory=dict)
    meta: dict[int, TickMeta] = field(default_factory=dict)
    ticks: list[int] = field(default_factory=list)
    roster: list[str] = field(default_factory=list)
    steam_to_pid: dict[str, str] = field(default_factory=dict)
    first_side: dict[str, Side] = field(default_factory=dict)

    def has(self, tick: int) -> bool:
        return tick in self.states

    def first_available(self, candidates: list[int]) -> int | None:
        for tick in candidates:
            if tick in self.states:
                return tick
        return None

    def prev(self, tick: int) -> int | None:
        """Latest available tick strictly before `tick`."""
        i = bisect.bisect_left(self.ticks, tick)
        return self.ticks[i - 1] if i > 0 else None

    def next_ge(self, tick: int) -> int | None:
        """Earliest available tick at or after `tick`."""
        i = bisect.bisect_left(self.ticks, tick)
        return self.ticks[i] if i < len(self.ticks) else None

    def nearest(self, tick: int) -> int | None:
        """Closest available tick to `tick` (ties resolve to the earlier tick)."""
        after = self.next_ge(tick)
        before = self.prev(tick)
        if after is None:
            return before
        if before is None:
            return after
        return before if (tick - before) <= (after - tick) else after


def build_tick_store(df) -> TickStore:
    """Build the store. Steam IDs are mapped to p01.. and never stored."""
    store = TickStore()
    if len(df) == 0:
        return store

    # Roster = real players (steam id != 0) who were on a team (T/CT) in at least one row.
    ids = sorted(
        {
            int(sid)
            for sid, team in zip(df["steamid"].tolist(), df["team_num"].tolist(), strict=True)
            if int(sid) != 0 and side_from_team_num(_i(team, -1)) is not None
        }
    )
    store.roster = [f"p{i + 1:02d}" for i in range(len(ids))]
    store.steam_to_pid = {str(sid): pid for sid, pid in zip(ids, store.roster, strict=True)}

    cols = {name: df[name].tolist() for name in df.columns if name != "name"}
    n = len(df)
    by_tick: dict[int, list[tuple[str, int, PlayerState, list[str]]]] = {}
    for row in range(n):
        sid = str(int(cols["steamid"][row]))
        pid = store.steam_to_pid.get(sid)
        if pid is None:
            continue
        tick = int(cols["tick"][row])
        side = side_from_team_num(_i(cols["team_num"][row], -1))
        if side is None:
            continue  # spectator / unassigned row: treated as missing
        inventory = [str(x) for x in (cols["inventory"][row] if cols["inventory"][row] is not None else [])]
        alive = bool(cols["is_alive"][row]) and _i(cols["health"][row]) > 0
        hp = _i(cols["health"][row]) if alive else 0
        active = cols["active_weapon_name"][row]
        active = active if isinstance(active, str) and active else None
        state: PlayerState = {
            "pid": pid,
            "side": side,
            "alive": alive,
            "hp": hp,
            "armor": _i(cols["armor_value"][row]),
            "helmet": bool(cols["has_helmet"][row]),
            "defuser": bool(cols["has_defuser"][row]),
            "x": _i(cols["X"][row]),
            "y": _i(cols["Y"][row]),
            "z": _i(cols["Z"][row]),
            "place": clean_place(cols["last_place_name"][row]),
            "activeWeapon": active,
            "primary": primary_weapon(inventory),
            "secondary": secondary_weapon(inventory),
            "utility": count_utility(inventory),
            "hasC4": has_c4(inventory),
            "money": _i(cols["balance"][row]),
            "equipValue": _i(cols["current_equip_value"][row]),
            "spottedBy": [],
        }
        mask = cols[_SPOT_COL][row]
        spotters = [str(int(s)) for s in (mask if mask is not None else [])]
        by_tick.setdefault(tick, []).append((pid, row, state, spotters))
        if pid not in store.first_side:
            store.first_side[pid] = side

    for tick in sorted(by_tick):
        entries = by_tick[tick]
        players: dict[str, PlayerState] = {}
        for pid, _row, state, _spot in entries:
            players[pid] = state
        for pid, _row, state, spotters in entries:
            enemies = sorted(
                {
                    store.steam_to_pid[s]
                    for s in spotters
                    if s in store.steam_to_pid
                    and store.steam_to_pid[s] in players
                    and players[store.steam_to_pid[s]]["side"] != state["side"]
                }
            )
            state["spottedBy"] = enemies
        first_row = entries[0][1]
        round_time = cols[_ROUND_TIME_COL][first_row]
        store.states[tick] = players
        store.meta[tick] = TickMeta(
            bomb_planted=bool(cols["is_bomb_planted"][first_row]),
            round_time=float(round_time) if round_time == round_time else None,
        )
    store.ticks = sorted(store.states)
    return store
