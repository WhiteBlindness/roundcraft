"""Pure helper functions for demo normalisation (no demo file needed, unit-testable)."""

from __future__ import annotations

import re
from collections.abc import Iterable, Sequence

from ..model import Side, Utility

# ---------------------------------------------------------------------------
# Round end reasons
# ---------------------------------------------------------------------------

# CS2 / CS:GO RoundEndReason enum. Cross-checked against both bundled demos:
# 1 target_bombed, 7 bomb_defused, 8 CT elimination, 9 T elimination and
# 18 CT surrender all occur with the matching winner and #SFUI_Notice_* message.
ROUND_END_REASONS: dict[int, str] = {
    1: "target_bombed",
    2: "vip_escaped",
    3: "vip_killed",
    4: "terrorists_escaped",
    5: "ct_stopped_escape",
    6: "terrorists_stopped",
    7: "bomb_defused",
    8: "ct_win_elimination",
    9: "t_win_elimination",
    10: "round_draw",
    11: "hostages_rescued",
    12: "time_ran_out",  # the engine calls this "target saved": CT win on the clock
    13: "hostages_not_rescued",
    14: "terrorists_not_escaped",
    15: "vip_not_escaped",
    16: "game_start",
    17: "t_surrender",
    18: "ct_surrender",
    19: "terrorists_planted",
    20: "cts_reached_hostage",
}


def round_end_reason(reason: int | None) -> str:
    if reason is None:
        return "reason_unknown"
    return ROUND_END_REASONS.get(int(reason), f"reason_{int(reason)}")


def side_from_team_num(team_num: int | None) -> Side | None:
    """demoparser2 team numbers: 2 = T, 3 = CT; anything else (0/1) is spectator/unassigned."""
    if team_num == 2:
        return "T"
    if team_num == 3:
        return "CT"
    return None


def opposite(side: Side) -> Side:
    return "CT" if side == "T" else "T"


# ---------------------------------------------------------------------------
# Inventory classification
# ---------------------------------------------------------------------------


def _key(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


_UTILITY_KEYS: dict[str, str] = {
    "smokegrenade": "smoke",
    "flashbang": "flash",
    "highexplosivegrenade": "he",
    "hegrenade": "he",
    "molotov": "molotov",
    "incendiarygrenade": "molotov",
    "incgrenade": "molotov",
    "decoygrenade": "decoy",
}

_PRIMARY_NAMES = [
    # rifles
    "AK-47", "M4A4", "M4A1-S", "Galil AR", "FAMAS", "SG 553", "AUG",
    # snipers
    "AWP", "SSG 08", "SCAR-20", "G3SG1",
    # SMGs
    "MAC-10", "MP9", "MP7", "MP5-SD", "UMP-45", "P90", "PP-Bizon",
    # shotguns
    "Nova", "XM1014", "Sawed-Off", "MAG-7",
    # machine guns
    "M249", "Negev",
]
_SECONDARY_NAMES = [
    "Glock-18", "USP-S", "P2000", "P250", "Five-SeveN", "Tec-9", "CZ75-Auto",
    "Desert Eagle", "Dual Berettas", "R8 Revolver",
]
_PRIMARY_KEYS = {_key(n) for n in _PRIMARY_NAMES} | {"m4a1", "m4a1silencer", "galil", "sg556", "bizon", "sawedoff"}
_SECONDARY_KEYS = {_key(n) for n in _SECONDARY_NAMES} | {
    "usp", "uspsilencer", "hkp2000", "deagle", "elite", "cz75a", "cz75", "revolver", "fiveseven", "tec9",
}

_C4_KEYS = {"c4explosive", "c4"}

# Event weapon codes (player_death.weapon) → normalised key of the inventory display name.
_EVENT_WEAPON_TO_INVENTORY_KEY = {
    "ak47": "ak47", "m4a1": "m4a4", "m4a1silencer": "m4a1s", "galilar": "galilar", "famas": "famas",
    "sg556": "sg553", "aug": "aug", "awp": "awp", "ssg08": "ssg08", "scar20": "scar20", "g3sg1": "g3sg1",
    "mac10": "mac10", "mp9": "mp9", "mp7": "mp7", "mp5sd": "mp5sd", "ump45": "ump45", "p90": "p90",
    "bizon": "ppbizon", "nova": "nova", "xm1014": "xm1014", "sawedoff": "sawedoff", "mag7": "mag7",
    "m249": "m249", "negev": "negev", "glock": "glock18", "uspsilencer": "usps", "hkp2000": "p2000",
    "p250": "p250", "fiveseven": "fiveseven", "tec9": "tec9", "cz75a": "cz75auto", "deagle": "deserteagle",
    "elite": "dualberettas", "revolver": "r8revolver",
}


def _event_weapon_key(event_weapon: str) -> str:
    return _key(event_weapon.lower().removeprefix("weapon_"))


def is_matchable_event_weapon(event_weapon: str | None) -> bool:
    """True for guns whose kill-event code can be compared with an inventory display name."""
    return bool(event_weapon) and _event_weapon_key(event_weapon) in _EVENT_WEAPON_TO_INVENTORY_KEY


def weapon_matches_event(inventory_display_name: str | None, event_weapon: str | None) -> bool:
    """True when an inventory/active weapon display name is the weapon named in a kill event.

    Unknown event weapons (grenades, knives, world) never match, so callers must treat
    "no match" as "cannot tell" for those.
    """
    if not inventory_display_name or not event_weapon:
        return False
    target = _EVENT_WEAPON_TO_INVENTORY_KEY.get(_event_weapon_key(event_weapon))
    if target is None:
        return False
    return _key(inventory_display_name) == target


def count_utility(inventory: Iterable[str] | None) -> Utility:
    """Count grenades in an inventory list. Molotov and Incendiary both count as molotov."""
    counts: Utility = {"smoke": 0, "flash": 0, "he": 0, "molotov": 0, "decoy": 0}
    for item in inventory or ():
        kind = _UTILITY_KEYS.get(_key(str(item)))
        if kind is not None:
            counts[kind] += 1  # type: ignore[literal-required]
    return counts


def primary_weapon(inventory: Sequence[str] | None) -> str | None:
    for item in inventory or ():
        if _key(str(item)) in _PRIMARY_KEYS:
            return str(item)
    return None


def secondary_weapon(inventory: Sequence[str] | None) -> str | None:
    for item in inventory or ():
        if _key(str(item)) in _SECONDARY_KEYS:
            return str(item)
    return None


def has_c4(inventory: Iterable[str] | None) -> bool:
    return any(_key(str(item)) in _C4_KEYS for item in inventory or ())


# ---------------------------------------------------------------------------
# Places and sites
# ---------------------------------------------------------------------------


def clean_place(place: object) -> str | None:
    """Empty/NaN place strings become None."""
    if place is None:
        return None
    text = str(place).strip()
    if not text or text.lower() in {"nan", "none"}:
        return None
    return text


def site_from_place(place: str | None) -> str | None:
    """'BombsiteA' -> 'A', 'BombsiteB' -> 'B', anything else -> None."""
    if not place:
        return None
    match = re.fullmatch(r"bomb ?site ?([ab])", place.strip(), flags=re.IGNORECASE)
    return match.group(1).upper() if match else None


# ---------------------------------------------------------------------------
# Numbers
# ---------------------------------------------------------------------------

HEADER_TICKRATES = (32, 64, 128)


def snap_tickrate(measured: float) -> int:
    """Snap a measured ticks-per-second value to the nearest CS2 tickrate."""
    return min(HEADER_TICKRATES, key=lambda rate: abs(rate - measured))


def round_t(seconds: float) -> float:
    return round(seconds + 0.0, 2)  # +0.0 normalises -0.0


def distance_3d(ax: float, ay: float, az: float, bx: float, by: float, bz: float) -> float:
    return ((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2) ** 0.5


UNITS_TO_METERS = 0.0254


def nearest_place(
    points: Sequence[tuple[float, float, float, str | None]],
    x: float,
    y: float,
    z: float,
) -> str | None:
    """Place name of the sampled point nearest (3-D) to (x, y, z).

    Ties resolve to the earliest point in `points`, so the result is deterministic.
    Points without a place name are ignored.
    """
    best: str | None = None
    best_d = float("inf")
    for px, py, pz, place in points:
        if place is None:
            continue
        d = (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2
        if d < best_d:
            best_d = d
            best = place
    return best
