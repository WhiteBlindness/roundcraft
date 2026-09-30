"""Identity-free rendering of groundTruth.timelineAfter for the REVEAL (never the brief).

Mined timeline entries look like {tick, t, offsetSeconds, type, description}; the description is
reviewer text that names players by pid ("p03 (T) killed p07 (CT) with ak47 in Connector"). Here it
is anonymised to sides only ("A T player killed a CT player with ak47 in Connector"). Entries in the
older structured shape ({type, data: {...}}) are still understood.
"""

from __future__ import annotations

import re
from typing import Any

from .features import Features
from .text import pretty_place, scrub, truncate

_UTILITY_NAMES = {"smoke": "smoke", "flash": "flash", "he": "HE grenade", "molotov": "molotov", "decoy": "decoy"}
_END_REASONS = {
    "bomb_exploded": "The bomb exploded.",
    "bomb_defused": "The bomb was defused.",
    "t_win_elimination": "The round ended when the T side was the last team standing.",
    "ct_win_elimination": "The round ended when the CT side was the last team standing.",
    "time_ran_out": "The round clock ran out.",
    "t_win_bomb": "The bomb exploded.",
    "ct_win_defuse": "The bomb was defused.",
}
_IMPORTANT = {"kill", "bomb_planted", "bomb_plant_begin", "bomb_defuse_begin", "bomb_defused", "bomb_exploded"}
_CONSEQUENCE = {
    "utility": "It changes what each side can see or hold near there.",
    "bomb_planted": "The bomb timer started.",
    "bomb_plant_begin": "The plant takes several seconds to finish.",
    "bomb_defuse_begin": "A defuse takes about 5 seconds with a kit and 10 without.",
    "bomb_defused": "The round ended in a CT win.",
    "bomb_exploded": "The round ended in a T win.",
    "bomb_pickup": "Who carries the bomb changes.",
    "bomb_drop": "The bomb is now on the ground.",
}
MAX_EVENTS = 12

_PID_SIDE = re.compile(r"\bp\d{2}\s*\((T|CT)\)", re.IGNORECASE)
_VICTIM_SIDE = re.compile(r"\bkilled\b.*?\((T|CT)\)", re.IGNORECASE)


_WEAPON_NAMES = {
    "ak47": "an AK-47", "m4a1": "an M4A4", "m4a1_silencer": "an M4A1-S", "m4a1_silencer_off": "an M4A1-S",
    "awp": "an AWP", "ssg08": "an SSG 08", "galilar": "a Galil AR", "famas": "a FAMAS", "aug": "an AUG",
    "sg556": "an SG 553", "deagle": "a Desert Eagle", "usp_silencer": "a USP-S", "usp_silencer_off": "a USP-S",
    "glock": "a Glock-18", "hkp2000": "a P2000", "p250": "a P250", "tec9": "a Tec-9", "fiveseven": "a Five-SeveN",
    "cz75a": "a CZ75-Auto", "elite": "Dual Berettas", "revolver": "an R8 Revolver", "mac10": "a MAC-10",
    "mp9": "an MP9", "mp7": "an MP7", "mp5sd": "an MP5-SD", "ump45": "a UMP-45", "p90": "a P90",
    "bizon": "a PP-Bizon", "nova": "a Nova", "xm1014": "an XM1014", "mag7": "a MAG-7", "sawedoff": "a Sawed-Off",
    "negev": "a Negev", "m249": "an M249", "g3sg1": "a G3SG1", "scar20": "a SCAR-20", "knife": "a knife",
    "knife_t": "a knife", "hegrenade": "an HE grenade", "inferno": "fire", "molotov": "a molotov",
    "incgrenade": "an incendiary", "taser": "a Zeus x27", "world": "the world",
}


def weapon_display(weapon_id: str) -> str:
    key = weapon_id.lower()
    if key.startswith("knife") or key.startswith("bayonet"):
        return "a knife"
    return _WEAPON_NAMES.get(key, key.replace("_", " "))


def anonymise(description: str) -> str:
    """'p03 (T) killed p07 (CT) ...' -> 'A T player killed a CT player ...' (sides only)."""
    text = _PID_SIDE.sub(lambda m: f"a {m.group(1).upper()} player", description)
    text = re.sub(r"\bp\d{2}\b", "a player", text, flags=re.IGNORECASE)
    text = re.sub(r"\bsomeone\b", "a player", text)
    text = re.sub(r"\bwith ([a-z0-9_]+)", lambda m: "with " + weapon_display(m.group(1)), text)
    text = scrub(text)
    return text[:1].upper() + text[1:] if text else text


def _flat(event: Any) -> dict[str, Any]:
    if isinstance(event, str):
        return {"type": "text", "description": event}
    data = dict(event)
    nested = data.pop("data", None)
    if isinstance(nested, dict):
        data = {**nested, **data}
    return data


def _side_name(value: Any) -> str | None:
    return value if value in ("T", "CT") else None


def _victim_side(event: dict[str, Any]) -> str | None:
    direct = _side_name(event.get("victimSide"))
    if direct:
        return direct
    match = _VICTIM_SIDE.search(str(event.get("description", "")))
    return match.group(1).upper() if match else None


def _place_suffix(place: Any, preposition: str = "in") -> str:
    pretty = pretty_place(place) if isinstance(place, str) else None
    return f" {preposition} {pretty}" if pretty else ""


def _describe(event: dict[str, Any]) -> tuple[str | None, str]:
    kind = event.get("type")
    description = event.get("description")
    if isinstance(description, str) and description.strip():
        action = anonymise(description.strip().rstrip(".")) + "."
        if kind == "kill":
            victim = _victim_side(event)
            return action, f"The {victim} side loses a player." if victim else "One side loses a player."
        return action, _CONSEQUENCE.get(str(kind), "The recorded events continue from here.")
    if kind == "kill":
        victim = _side_name(event.get("victimSide"))
        attacker = _side_name(event.get("attackerSide"))
        subject = f"A {victim} player" if victim else "A player"
        by = f" by a {attacker} player" if attacker else ""
        return (f"{subject} was eliminated{_place_suffix(event.get('victimPlace'))}{by}.",
                f"The {victim} side loses a player." if victim else "One side loses a player.")
    if kind == "utility":
        name = _UTILITY_NAMES.get(str(event.get("kind")), "grenade")
        side = _side_name(event.get("side"))
        return f"A {side + ' ' if side else ''}{name} was thrown{_place_suffix(event.get('place'), 'near')}.", _CONSEQUENCE["utility"]
    if kind == "bomb_planted":
        site = event.get("site")
        where = f" on site {site}" if site else ""
        return f"The bomb was planted{where}{_place_suffix(event.get('place'))}.", _CONSEQUENCE["bomb_planted"]
    if kind == "bomb_plant_begin":
        return "The bomb carrier began to plant.", _CONSEQUENCE["bomb_plant_begin"]
    if kind == "bomb_defuse_begin":
        return "A defuse began.", _CONSEQUENCE["bomb_defuse_begin"]
    if kind == "bomb_defused":
        return "The bomb was defused.", _CONSEQUENCE["bomb_defused"]
    if kind == "bomb_exploded":
        return "The bomb exploded.", _CONSEQUENCE["bomb_exploded"]
    return None, ""


def render_timeline(candidate: dict[str, Any], f: Features) -> tuple[list[dict[str, str]], list[str], list[str]]:
    """Return (events, issues, raw_actions). raw_actions carry no 'In the source round' prefix."""
    issues: list[str] = []
    truth = candidate.get("groundTruth") or {}
    raw = truth.get("timelineAfter") or []
    decision_t = float(candidate.get("decisionT", 0.0))
    own, enemy = f.own_alive, f.enemy_alive
    planted = f.bomb_status == "planted"
    own_side = f.perspective

    flat = [_flat(item) for item in raw if isinstance(item, (dict, str))]
    typed = [e for e in flat if e.get("type") in _IMPORTANT or e.get("type") in ("utility", "text")]
    important = [e for e in typed if e.get("type") in _IMPORTANT or e.get("type") == "text"]
    chosen = typed if len(typed) <= MAX_EVENTS else important
    if len(chosen) > MAX_EVENTS:
        chosen = chosen[: MAX_EVENTS - 1] + [chosen[-1]]
    if len(typed) > len(chosen):
        issues.append(f"The mined timeline had {len(typed)} events; the reveal shows {len(chosen)} "
                      "(kills and bomb events first, then utility while room remains).")
    shown_ids = {id(e) for e in chosen}

    events: list[dict[str, str]] = []
    raw_actions: list[str] = []
    for event in flat:
        kind = event.get("type")
        if kind == "kill":  # alive counts follow every kill, shown or not
            victim = _victim_side(event)
            if victim == own_side:
                own = max(0, own - 1)
            elif victim:
                enemy = max(0, enemy - 1)
        if kind == "bomb_planted":
            planted = True
        if id(event) not in shown_ids:
            continue
        action, consequence = _describe(event)
        if action is None:
            continue
        offset = event.get("offsetSeconds")
        if not isinstance(offset, (int, float)) and isinstance(event.get("t"), (int, float)):
            offset = float(event["t"]) - decision_t
        stamp = f"+{max(0.0, float(offset)):.0f} s" if isinstance(offset, (int, float)) else "later"
        state = f"Alive: {own} for your team, {enemy} for the opposing team."
        if planted:
            state += " The bomb is planted."
        raw_actions.append(truncate(scrub(action), 400))
        events.append({"timestamp": stamp, "action": truncate(scrub(action), 1200),
                       "consequence": truncate(scrub(consequence), 1200), "state": state})
    if events:
        first = events[0]
        head = first["action"]
        first_word = head.split(" ", 1)[0]
        keep = first_word in ("T", "CT") or (len(first_word) > 1 and first_word.isupper())
        first["action"] = "In the source round, " + (head if keep else head[0].lower() + head[1:])
        return events, issues, raw_actions

    issues.append("groundTruth.timelineAfter is missing or empty; the reveal continuation is a single placeholder event.")
    outcome = render_outcome(candidate, f)
    return [{
        "timestamp": "+0 s",
        "action": "In the source round, the mined data records no separate events after the decision point.",
        "consequence": "The recorded line is described in the comparison.",
        "state": outcome or "The mined data ends at the decision point.",
    }], issues, []


def render_outcome(candidate: dict[str, Any], f: Features, *, winner_only: bool = False) -> str:
    truth = candidate.get("groundTruth") or {}
    outcome = truth.get("outcome")
    if isinstance(outcome, dict):
        reason = outcome.get("endReason")
        winner = _side_name(outcome.get("winner"))
        parts = []
        if reason and not winner_only:
            parts.append(_END_REASONS.get(str(reason), f"The round ended ({str(reason).replace('_', ' ')})."))
        if winner:
            parts.append(f"The {winner} side won the round.")
        return " ".join(parts)
    if isinstance(outcome, str):
        return scrub(outcome)
    return ""
