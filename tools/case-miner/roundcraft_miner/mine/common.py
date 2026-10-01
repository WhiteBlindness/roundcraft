"""Shared helpers for the mining stage: frame lookup, round state, wording.

Everything here is pure and deterministic. Two kinds of functions live here and
must not be mixed up:

* ground-truth helpers (`players_at`, `true_bomb_state`, ...) read the omniscient
  demo and are only ever used for detection, scoring and `Candidate.groundTruth`;
* wording helpers (`pretty_place`, `number_word`, ...) are used to write facts.
"""

from __future__ import annotations

import bisect
import re
from typing import Any

Side = str
Round = dict[str, Any]
Match = dict[str, Any]

_FRAME_TICK_CACHE: dict[int, tuple[list[dict[str, Any]], int, list[int]]] = {}


def other_side(side: Side) -> Side:
    return "CT" if side == "T" else "T"


# ---------------------------------------------------------------------------
# Time and frames
# ---------------------------------------------------------------------------


def _frame_ticks(round_: Round) -> list[int]:
    frames = round_["frames"]
    hit = _FRAME_TICK_CACHE.get(id(frames))
    if hit is not None and hit[0] is frames and hit[1] == len(frames):
        return hit[2]
    ticks = [frame["tick"] for frame in frames]
    if len(_FRAME_TICK_CACHE) > 512:
        _FRAME_TICK_CACHE.clear()
    _FRAME_TICK_CACHE[id(frames)] = (frames, len(frames), ticks)
    return ticks


def frame_index_at(round_: Round, tick: int) -> int | None:
    """Index of the latest frame with frame.tick <= tick, or None when there is none."""
    index = bisect.bisect_right(_frame_ticks(round_), tick) - 1
    return index if index >= 0 else None


def snap_to_frame(round_: Round, tick: int) -> int | None:
    index = frame_index_at(round_, tick)
    return None if index is None else round_["frames"][index]["tick"]


def tick_t(match: Match, round_: Round, tick: int) -> float:
    """Seconds since freeze end at `tick`, rounded to 0.01 s."""
    return round((tick - round_["freezeEndTick"]) / match["tickrate"], 2)


def seconds_to_ticks(match: Match, seconds: float) -> int:
    return int(round(seconds * match["tickrate"]))


def events_of(round_: Round, *types: str, upto: int | None = None) -> list[dict[str, Any]]:
    wanted = set(types)
    return [
        event
        for event in round_["events"]
        if (not wanted or event["type"] in wanted) and (upto is None or event["tick"] <= upto)
    ]


def kill_events(round_: Round, *, upto: int | None = None) -> list[dict[str, Any]]:
    """Kills with a known victim. Parser output can contain unresolved kills (victim None); they carry
    no usable state change, so they are ignored everywhere in the miner."""
    return [e for e in events_of(round_, "kill", upto=upto) if e["data"].get("victim")]


def dead_pids_at(round_: Round, tick: int) -> set[str]:
    return {event["data"].get("victim") for event in kill_events(round_, upto=tick)} - {None}


def players_at(round_: Round, tick: int) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """(latest frame <= tick, its players with kills up to `tick` applied).

    Kills that happened between the frame and `tick` mark the victim dead, so a
    tick that is not a frame tick still has correct alive counts. Returned player
    dicts are copies only where `alive` had to change.
    """
    index = frame_index_at(round_, tick)
    if index is None:
        raise ValueError(f"tick {tick} is before the first frame of round {round_.get('number')}")
    frame = round_["frames"][index]
    dead = dead_pids_at(round_, tick)
    players = []
    for player in frame["players"]:
        if player["alive"] and player["pid"] in dead:
            player = {**player, "alive": False}
        players.append(player)
    return frame, players


def alive_counts(players: list[dict[str, Any]], perspective: Side) -> tuple[int, int]:
    own = sum(1 for p in players if p["alive"] and p["side"] == perspective)
    enemy = sum(1 for p in players if p["alive"] and p["side"] != perspective)
    return own, enemy


def utility_total(players: list[dict[str, Any]], side: Side, kinds: tuple[str, ...] = ("smoke", "flash", "molotov")) -> int:
    return sum(p["utility"].get(kind, 0) for p in players if p["alive"] and p["side"] == side for kind in kinds)


# ---------------------------------------------------------------------------
# Bomb (ground truth)
# ---------------------------------------------------------------------------


def plant_info(round_: Round, tick: int) -> dict[str, Any] | None:
    """The plant as it stands at `tick`: {tick, t, site, place, x, y} or None."""
    for event in round_["events"]:
        if event["type"] == "bomb_planted" and event["tick"] <= tick:
            data = event["data"]
            return {
                "tick": event["tick"],
                "t": event["t"],
                "site": data.get("site"),
                "place": data.get("place"),
                "x": data.get("x"),
                "y": data.get("y"),
            }
    for frame in round_["frames"]:
        if frame["tick"] > tick:
            break
        if frame.get("bombPlanted"):
            return {"tick": frame["tick"], "t": frame["t"], "site": None, "place": None, "x": None, "y": None}
    return None


def true_bomb_state(round_: Round, tick: int) -> dict[str, Any]:
    """Omniscient bomb state at `tick`. Reviewer-only (Candidate.groundTruth)."""
    plant = plant_info(round_, tick)
    if plant is not None:
        state: dict[str, Any] = {"status": "planted", "site": plant["site"], "place": plant["place"], "plantTick": plant["tick"]}
        for event in events_of(round_, "bomb_defused", "bomb_exploded", upto=tick):
            state["status"] = "defused" if event["type"] == "bomb_defused" else "exploded"
        return state
    _, players = players_at(round_, tick)
    for player in players:
        if player["alive"] and player.get("hasC4"):
            return {"status": "carried", "place": player.get("place"), "x": player.get("x"), "y": player.get("y"), "carrierSide": player["side"]}
    drops = [e for e in events_of(round_, "bomb_drop", "bomb_pickup", upto=tick)]
    if drops and drops[-1]["type"] == "bomb_drop":
        data = drops[-1]["data"]
        return {"status": "dropped", "place": data.get("place"), "x": data.get("x"), "y": data.get("y"), "dropTick": drops[-1]["tick"]}
    return {"status": "dropped", "place": None}


# ---------------------------------------------------------------------------
# Map geometry (data-driven, no hand-written tactical rules)
# ---------------------------------------------------------------------------


def site_centroids(match: Match) -> dict[str, tuple[float, float]]:
    """Centre of each bombsite from where players stood inside the site's own place.

    Falls back to plant positions when nobody stood in a site place. Purely
    descriptive geometry read from the demo; used only to decide which players
    are "near a site".
    """
    sums: dict[str, list[float]] = {}
    for round_ in match["rounds"]:
        for frame in round_["frames"][::4]:
            for player in frame["players"]:
                site = _site_of_place(player.get("place"))
                if site and player["alive"]:
                    acc = sums.setdefault(site, [0.0, 0.0, 0.0])
                    acc[0] += player["x"]
                    acc[1] += player["y"]
                    acc[2] += 1
    for round_ in match["rounds"]:
        for event in round_["events"]:
            data = event["data"]
            if event["type"] == "bomb_planted" and data.get("site") in ("A", "B") and data.get("x") is not None and data["site"] not in sums:
                acc = sums.setdefault(data["site"], [0.0, 0.0, 0.0])
                acc[0] += data["x"]
                acc[1] += data["y"]
                acc[2] += 1
    return {site: (acc[0] / acc[2], acc[1] / acc[2]) for site, acc in sorted(sums.items()) if acc[2] > 0}


def _site_of_place(place: str | None) -> str | None:
    if not place:
        return None
    found = re.fullmatch(r"bomb ?site ?([ab])", place.strip(), flags=re.IGNORECASE)
    return found.group(1).upper() if found else None


def dist2d(ax: float, ay: float, bx: float, by: float) -> float:
    return ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5


# ---------------------------------------------------------------------------
# Wording
# ---------------------------------------------------------------------------

_PLACE_OVERRIDES = {
    "BombsiteA": "A site",
    "BombsiteB": "B site",
    "CTSpawn": "CT Spawn",
    "TSpawn": "T Spawn",
    "TopofMid": "Top of Mid",
    "PalaceAlley": "Palace Alley",
    "TRamp": "T Ramp",
    "SecondMid": "Second Mid",
    "UnderA": "Under A",
    "LowerTunnel": "Lower Tunnel",
    "UpperTunnel": "Upper Tunnel",
    "SnipersNest": "Sniper's Nest",
}

UNNAMED_PLACE = "an unnamed area"


def pretty_place(place: str | None) -> str:
    """Demo place name -> readable text. 'BombsiteA' -> 'A site'; None -> 'an unnamed area'."""
    if not place:
        return UNNAMED_PLACE
    if place in _PLACE_OVERRIDES:
        return _PLACE_OVERRIDES[place]
    return re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", place).replace("_", " ").strip()


def slug(text: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (text or "none").lower()).strip("_") or "none"


_NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]


def number_word(n: int, *, capitalise: bool = False) -> str:
    word = _NUMBER_WORDS[n] if 0 <= n < len(_NUMBER_WORDS) else str(n)
    return word.capitalize() if capitalise else word


# Demo weapon ids (kill events) -> the display name used everywhere else (frames, loadouts, facts).
_WEAPON_NAMES = {
    "ak47": "AK-47", "m4a1": "M4A4", "m4a1_silencer": "M4A1-S", "m4a1_silencer_off": "M4A1-S",
    "awp": "AWP", "ssg08": "SSG 08", "galilar": "Galil AR", "famas": "FAMAS", "aug": "AUG",
    "sg556": "SG 553", "g3sg1": "G3SG1", "scar20": "SCAR-20",
    "mac10": "MAC-10", "mp9": "MP9", "mp7": "MP7", "mp5sd": "MP5-SD", "ump45": "UMP-45", "p90": "P90",
    "bizon": "PP-Bizon", "nova": "Nova", "xm1014": "XM1014", "sawedoff": "Sawed-Off", "mag7": "MAG-7",
    "m249": "M249", "negev": "Negev",
    "glock": "Glock-18", "usp_silencer": "USP-S", "usp_silencer_off": "USP-S", "hkp2000": "P2000",
    "p250": "P250", "fiveseven": "Five-SeveN", "tec9": "Tec-9", "cz75a": "CZ75-Auto",
    "deagle": "Desert Eagle", "elite": "Dual Berettas", "revolver": "R8 Revolver",
}

_WEAPON_CLASSES = {
    "rifle": ("AK-47", "M4A4", "M4A1-S", "Galil AR", "FAMAS", "AUG", "SG 553"),
    "sniper": ("AWP", "SSG 08", "G3SG1", "SCAR-20"),
    "smg": ("MAC-10", "MP9", "MP7", "MP5-SD", "UMP-45", "P90", "PP-Bizon"),
    "heavy": ("Nova", "XM1014", "Sawed-Off", "MAG-7", "M249", "Negev"),
    "pistol": ("Glock-18", "USP-S", "P2000", "P250", "Five-SeveN", "Tec-9", "CZ75-Auto", "Desert Eagle", "Dual Berettas", "R8 Revolver"),
}
_CLASS_OF = {name.lower(): cls for cls, names in _WEAPON_CLASSES.items() for name in names}
_GUNS = set(_CLASS_OF)
_AN_PREFIXES = ("AK", "AWP", "AUG", "M4", "M249", "MP", "SSG", "SG", "UMP", "XM", "R8")


def weapon_display(weapon: str | None) -> str | None:
    """Demo weapon id ('ak47') or display name ('AK-47') -> display name; None for empty input.
    Unknown weapons (knives, grenades, the bomb) come back unchanged."""
    if not weapon:
        return None
    return _WEAPON_NAMES.get(weapon.lower(), weapon)


def weapon_class(weapon: str | None) -> str | None:
    """'rifle' | 'sniper' | 'smg' | 'heavy' | 'pistol', or None for anything that is not a known gun."""
    name = weapon_display(weapon)
    return _CLASS_OF.get(name.lower()) if name else None


def weapon_phrase(weapon: str | None) -> str | None:
    """'an AWP' / 'a Glock-18'; None for knives, grenades, the bomb or anything that is not a known gun."""
    name = weapon_display(weapon)
    if not name or name.lower() not in _GUNS:
        return None
    article = "an" if name.startswith(_AN_PREFIXES) else "a"
    return f"{article} {name}"


def side_word(side: Side, *, plural: bool = True) -> str:
    """What the *other* team is called in facts: attackers = T, defenders = CT."""
    base = "attacker" if side == "T" else "defender"
    return base + ("s" if plural else "")


def indefinite(noun: str, *, capitalise: bool = True) -> str:
    """'An attacker' / 'A defender'."""
    article = "an" if noun[:1].lower() in "aeiou" else "a"
    return f"{article.capitalize() if capitalise else article} {noun}"


def plural(n: int, singular: str, plural_form: str | None = None) -> str:
    return f"{n} {singular if n == 1 else (plural_form or singular + 's')}"


def fmt_seconds(value: float) -> str:
    if value < 2.5:
        text = f"{value:.1f}"
        return text.rstrip("0").rstrip(".") + " s" if "." in text else text + " s"
    return f"{int(round(value))} s"


def fit_text(text: str, *, limit: int = 200, minimum: int = 8) -> str:
    """Roundcraft facts are 8-200 characters (the domain schema allows 500; the miner is stricter)."""
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > limit:
        text = text[: limit - 1].rstrip() + "…"
    if len(text) < minimum:
        text = text.ljust(minimum, ".")
    return text


# ---------------------------------------------------------------------------
# Match structure (public round history)
# ---------------------------------------------------------------------------


def halftime_round_number(match: Match) -> int | None:
    """Number of the first round after the half-time side swap, read from the pids' sides; None when the
    parsed rounds never show a swap. Only the first swap counts: later swaps are overtime, not half-time."""
    previous: dict[str, str] | None = None
    for round_ in match["rounds"]:
        if not round_["frames"]:
            continue
        sides = {p["pid"]: p["side"] for p in round_["frames"][0]["players"]}
        if previous is not None:
            shared = [pid for pid in sides if pid in previous]
            swapped = sum(1 for pid in shared if sides[pid] != previous[pid])
            if shared and swapped * 2 > len(shared):
                return round_["number"]
        previous = sides
    return None


def is_pistol_round(match: Match, round_: Round) -> bool:
    """The first round of a half: round 1, or the first round after the half-time swap."""
    return round_["number"] == 1 or round_["number"] == halftime_round_number(match)
