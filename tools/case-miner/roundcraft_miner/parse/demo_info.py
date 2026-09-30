"""Cheap facts about a demo file: map, patch and tickrate."""

from __future__ import annotations

from pathlib import Path

from .helpers import snap_tickrate


class DemoReadError(RuntimeError):
    pass


def _parser(path: Path):
    from demoparser2 import DemoParser  # imported lazily: heavy native module

    return DemoParser(str(path))


def detect_tickrate(parser) -> int:
    """Measure ticks per game-time second around the first live round, snapped to 32/64/128.

    The demo header carries no tickrate. `game_time` advances 1/tickrate per tick, so a
    tick delta divided by the game_time delta recovers it. Recording snapshots may be
    sparse (the Inferno test demo only has every 3rd tick), which does not matter here.
    """
    starts = parser.parse_event("round_freeze_end")
    ticks = sorted(int(t) for t in starts["tick"]) if len(starts) else []
    anchor = ticks[-1] if ticks else 2000
    for base in (anchor, ticks[0] if ticks else 2000, 2000):
        df = parser.parse_ticks(["game_time"], ticks=list(range(base, base + 640)))
        if len(df) == 0:
            continue
        per_tick = df.groupby("tick")["game_time"].first().sort_index()
        if len(per_tick) < 2:
            continue
        dt = float(per_tick.index[-1] - per_tick.index[0])
        dg = float(per_tick.iloc[-1] - per_tick.iloc[0])
        if dg > 0:
            return snap_tickrate(dt / dg)
    return 64


def read_demo_info(path: Path) -> dict[str, object]:
    """Return {'mapName', 'patchVersion', 'tickrate'} read from the demo."""
    try:
        parser = _parser(path)
        header = parser.parse_header()
    except Exception as exc:  # native parser raises bare Exceptions
        raise DemoReadError(f"cannot read demo header of {path.name}: {exc}") from exc
    map_name = header.get("map_name")
    if not map_name:
        raise DemoReadError(f"{path.name}: header has no map_name")
    patch = header.get("patch_version")
    return {
        "mapName": str(map_name),
        "patchVersion": str(patch) if patch else None,
        "tickrate": detect_tickrate(parser),
    }
