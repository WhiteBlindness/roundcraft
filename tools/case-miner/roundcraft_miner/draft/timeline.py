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
_IMPORTANT = {"kill", "bomb_planted", "bomb_plant_begin", "bomb_defuse_begin", "bomb_defused", "bomb_exploded", "round_end"}
_CONTEXT = {"bomb_pickup", "bomb_drop"}
_MINOR = {"utility", "text"}
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
# End reasons as the mined data spells them -> how the round was won (the winner is named separately).
_END_HOW = {
    "t_win_elimination": "by eliminating the defenders",
    "ct_win_elimination": "by eliminating the attackers",
    "bomb_exploded": "when the bomb exploded",
    "t_win_bomb": "when the bomb exploded",
    "bomb_defused": "when the bomb was defused",
    "ct_win_defuse": "when the bomb was defused",
    "time_ran_out": "when the round clock ran out",
    "t_win_time": "when the round clock ran out",
}
_END_WINNER = {"t_win_elimination": "T", "t_win_bomb": "T", "bomb_exploded": "T", "ct_win_elimination": "CT",
               "ct_win_defuse": "CT", "bomb_defused": "CT", "time_ran_out": "CT"}
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


_DETONATED = re.compile(r"\b(?:detonated|set off) an? (he|flash|smoke|molotov|decoy|incendiary)\b", re.IGNORECASE)
_UTILITY_PHRASE = {"he": "an HE grenade", "flash": "a flash", "smoke": "a smoke", "molotov": "a molotov",
                   "decoy": "a decoy", "incendiary": "an incendiary"}
_ACTOR_SIDE = {"bomb_plant_begin": "T", "bomb_planted": "T", "bomb_pickup": "T", "bomb_drop": "T",
               "bomb_defuse_begin": "CT", "bomb_defused": "CT"}


def _with_actor_side(kind: Any, text: str) -> str:
    """The plant, pickup and defuse are always done by one side; say so instead of 'a player'."""
    side = _ACTOR_SIDE.get(str(kind))
    return re.sub(r"^A player\b", f"A {side} player", text) if side else text


def _utility_wording(text: str) -> str:
    return _DETONATED.sub(lambda m: f"threw {_UTILITY_PHRASE[m.group(1).lower()]} that detonated", text)


def _describe(event: dict[str, Any]) -> tuple[str | None, str]:
    kind = event.get("type")
    description = event.get("description")
    if isinstance(description, str) and description.strip():
        action = _with_actor_side(kind, anonymise(_utility_wording(description.strip().rstrip("."))) + ".")
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
    if kind == "bomb_pickup":
        return "A T player picked up the bomb.", _CONSEQUENCE["bomb_pickup"]
    if kind == "bomb_drop":
        return "The bomb carrier dropped the bomb.", _CONSEQUENCE["bomb_drop"]
    return None, ""


def _tier(event: dict[str, Any]) -> int:
    kind = event.get("type")
    if kind in _IMPORTANT:
        return 1
    if kind in _CONTEXT:
        return 2
    return 3 if kind in _MINOR else 0


def select_events(flat: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    """Choose at most MAX_EVENTS events to show. Kills, bomb events and the round end come first; when even
    those do not fit, the LAST ones are kept, because they decide the round. Returns (chosen, eligible)."""
    eligible = [e for e in flat if _tier(e)]
    if len(eligible) <= MAX_EVENTS:
        return eligible, len(eligible)
    decisive = [e for e in eligible if _tier(e) == 1]
    if len(decisive) >= MAX_EVENTS:
        return decisive[-MAX_EVENTS:], len(eligible)
    order = {id(e): i for i, e in enumerate(eligible)}
    extras = sorted((e for e in eligible if _tier(e) > 1), key=lambda e: (_tier(e), order[id(e)]))
    picked = decisive + extras[: MAX_EVENTS - len(decisive)]
    return sorted(picked, key=lambda e: order[id(e)]), len(eligible)


def _outcome(candidate: dict[str, Any]) -> dict[str, Any]:
    outcome = (candidate.get("groundTruth") or {}).get("outcome")
    return outcome if isinstance(outcome, dict) else {}


def _survivors_phrase(count: Any) -> str | None:
    if not isinstance(count, int) or count < 0:
        return None
    return "none of your team survived" if count == 0 else ("one of your team survived" if count == 1 else f"{count} of your team survived")


def result_sentence(outcome: dict[str, Any], *, survivors: bool = True) -> str:
    """'The Ts won by eliminating the defenders; none of your team survived.' (never the raw reason code)."""
    reason = str(outcome.get("endReason") or "")
    winner = _side_name(outcome.get("winner")) or _END_WINNER.get(reason)
    how = _END_HOW.get(reason)
    if not winner and not how:
        return ""
    parts = f"The {winner}s won" if winner else "The round was decided"
    sentence = f"{parts} {how}" if how else parts
    if survivors:
        phrase = _survivors_phrase(outcome.get("ownSurvivors"))
        if phrase:
            sentence += f"; {phrase}"
    return sentence + "."


_RESULT_CLAUSE = re.compile(r"\s*Result:.*$", re.DOTALL)
_COUNTED_UTILITY = re.compile(r"\b(\d+) (he|flash|smoke|molotov|decoy)\b")
_PLURAL = {"he": ("HE grenade", "HE grenades"), "flash": ("flash", "flashes"), "smoke": ("smoke", "smokes"),
           "molotov": ("molotov", "molotovs"), "decoy": ("decoy", "decoys")}
_RAW_REASON = {"t win elimination": "the attackers eliminated the defenders",
               "ct win elimination": "the defenders eliminated the attackers"}


def _fix_utility_counts(text: str) -> str:
    def render(match: re.Match[str]) -> str:
        n, kind = int(match.group(1)), match.group(2).lower()
        one, many = _PLURAL[kind]
        return f"{n} {one if n == 1 else many}"

    return _COUNTED_UTILITY.sub(render, text)


def readable_actual_line(actual: str, candidate: dict[str, Any], extra: str = "") -> str:
    """The recorded line without its raw 'Result: ... (t win elimination)' clause, which is rewritten in plain words."""
    actual = _fix_utility_counts(actual)
    outcome = _outcome(candidate)
    result = result_sentence(outcome)
    if result:
        actual = _RESULT_CLAUSE.sub("", actual).rstrip()
        if actual and not actual.endswith("."):
            actual += "."
        return " ".join(part for part in (actual, extra, result) if part)
    for raw, plain in _RAW_REASON.items():
        actual = actual.replace(f"({raw})", f"({plain})")
    return f"{actual} {extra}".strip() if extra else actual


def _offset_of(event: dict[str, Any], decision_t: float) -> float | None:
    offset = event.get("offsetSeconds")
    if not isinstance(offset, (int, float)) and isinstance(event.get("t"), (int, float)):
        offset = float(event["t"]) - decision_t
    return float(offset) if isinstance(offset, (int, float)) else None


def decisive_summary(candidate: dict[str, Any]) -> str:
    """One sentence on defuse attempts and the bomb's end, taken from the recorded timeline ('' when there are none)."""
    decision_t = float(candidate.get("decisionT", 0.0))
    flat = [_flat(item) for item in (candidate.get("groundTruth") or {}).get("timelineAfter") or [] if isinstance(item, (dict, str))]
    begins = [o for e in flat if e.get("type") == "bomb_defuse_begin" and (o := _offset_of(e, decision_t)) is not None]
    defused = next((e for e in flat if e.get("type") == "bomb_defused"), None)
    exploded = any(e.get("type") == "bomb_exploded" for e in flat)
    if not begins and not defused:
        return "The bomb exploded." if exploded else ""
    times = " and ".join(f"{max(0.0, o):.0f} s" for o in begins[:3])
    at = _offset_of(defused, decision_t) if defused is not None else None
    if defused is not None:
        when = f" {max(0.0, at):.0f} s after the decision" if at is not None else ""
        if not begins:
            return f"The bomb was defused{when}."
        tail = f" at {max(0.0, at):.0f} s" if at is not None else ""
        return f"A defuse began {times} after the decision and the bomb was defused{tail}."
    if len(begins) == 1:
        return f"A defuse began {times} after the decision but was not completed."
    return f"Defuses began {times} after the decision; none was completed."


def render_timeline(candidate: dict[str, Any], f: Features) -> tuple[list[dict[str, str]], list[str], list[str]]:
    """Return (events, issues, raw_actions). raw_actions carry no 'In the source round' prefix."""
    issues: list[str] = []
    raw = (candidate.get("groundTruth") or {}).get("timelineAfter") or []
    decision_t = float(candidate.get("decisionT", 0.0))
    outcome = _outcome(candidate)
    own, enemy = f.own_alive, f.enemy_alive
    planted = f.bomb_status == "planted"
    own_side = f.perspective

    flat = [_flat(item) for item in raw if isinstance(item, (dict, str))]
    chosen, eligible = select_events(flat)
    if any(e.get("type") in ("bomb_defused", "bomb_exploded") for e in chosen):
        # The defuse or explosion already ends the round; a second "the round ended" line only repeats it.
        chosen = [e for e in chosen if e.get("type") != "round_end"]
    has_end = any(e.get("type") in ("round_end", "bomb_defused", "bomb_exploded") for e in chosen)
    if not has_end and outcome and result_sentence(outcome):
        # Older timelines stop before the round ends: close it from the recorded outcome (no invented time).
        chosen = chosen[-(MAX_EVENTS - 1):] + [{"type": "round_end", "_synthetic": True}]
        eligible += 1
        issues.append("The recorded timeline stops before the round end; the closing reveal event comes from the recorded outcome.")
    if eligible > len(chosen):
        issues.append(f"The recorded timeline had {eligible} events; the reveal shows {len(chosen)} "
                      "(kills, bomb events and the round end first, keeping the last decisive events; then context and utility while room remains).")
    shown_ids = {id(e) for e in chosen}

    events: list[dict[str, str]] = []
    raw_actions: list[str] = []
    for event in flat + [e for e in chosen if e.get("_synthetic")]:
        kind = event.get("type")
        last_player = None
        if kind == "kill":  # alive counts follow every kill, shown or not
            victim = _victim_side(event)
            if victim == own_side:
                own = max(0, own - 1)
                last_player = own == 0
            elif victim:
                enemy = max(0, enemy - 1)
                last_player = enemy == 0
        if kind == "bomb_planted":
            planted = True
        if id(event) not in shown_ids:
            continue
        if kind == "round_end":
            action = result_sentence({**outcome, **{k: v for k, v in event.items() if k in ("endReason", "winner")}}, survivors=False)
            if action:
                action = "The round ended: " + action[0].lower() + action[1:]
            elif isinstance(event.get("description"), str) and event["description"].strip():
                action = anonymise(event["description"].strip().rstrip(".")) + "."
            else:
                action = "The round ended."
            consequence = "The round is over."
            if outcome.get("perspectiveWon") is True:
                consequence = "The round is over and your team won it."
            elif outcome.get("perspectiveWon") is False:
                consequence = "The round is over and your team lost it."
            survivors = (outcome.get("ownSurvivors"), outcome.get("enemySurvivors"))
            if all(isinstance(n, int) for n in survivors):
                own, enemy = survivors  # type: ignore[assignment]
            offset = None if event.get("_synthetic") else _offset_of(event, decision_t)
            stamp = f"+{max(0.0, offset):.0f} s" if offset is not None else "Round end"
        else:
            action, consequence = _describe(event)
            if action is None:
                continue
            if last_player:
                consequence = consequence.replace("loses a player", "loses its last player")
            offset = _offset_of(event, decision_t)
            stamp = f"+{max(0.0, offset):.0f} s" if offset is not None else "later"
        state = f"Alive: {own} for your team, {enemy} for the opposing team."
        if planted:
            state += " The bomb is planted."
        if kind != "round_end":  # the result is stated separately by the comparison
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
    text = render_outcome(candidate, f)
    return [{
        "timestamp": "+0 s",
        "action": "In the source round, no separate events are recorded after the decision point.",
        "consequence": "The recorded line is described in the comparison.",
        "state": text or "The record ends at the decision point.",
    }], issues, []


def render_outcome(candidate: dict[str, Any], f: Features, *, winner_only: bool = False) -> str:
    truth = candidate.get("groundTruth") or {}
    outcome = truth.get("outcome")
    if isinstance(outcome, dict):
        return result_sentence(outcome, survivors=not winner_only)
    if isinstance(outcome, str):
        return scrub(outcome)
    return ""
