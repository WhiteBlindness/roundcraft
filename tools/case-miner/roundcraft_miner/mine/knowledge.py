"""The player-knowledge layer.

`knowledge_view(match, round_, tick, perspective)` answers one question: what
could the deciding team know at `tick`? The demo is omniscient; the team is not.
Only frames and events with tick <= `tick` are read, and every enemy field that
ends up in the view is backed by a sighting (an own, alive player in the enemy's
`spottedBy`) at a frame no later than `tick`.

Ground truth never enters this module's output: unknown enemies carry no
position at all, own players' `spottedBy` (which enemies can see *them*) is
blanked, and future events are never read.
"""

from __future__ import annotations

from typing import Any

from ..model import DerivedFact, KnowledgeView, KnownBomb, KnownEnemy, ObservedUtility
from .common import (
    dead_pids_at,
    dist2d,
    events_of,
    fit_text,
    fmt_seconds,
    frame_index_at,
    halftime_round_number,
    is_pistol_round,
    kill_events,
    number_word,
    other_side,
    plant_info,
    plural,
    pretty_place,
    seconds_to_ticks,
    side_word,
    slug,
    tick_t,
    weapon_class,
    weapon_phrase,
)

# --- thresholds (all in seconds / world units) -------------------------------
CONFIRM_WINDOW_S = 2.0  # seen within this long ago -> "confirmed"
STALE_AFTER_S = 45.0  # older sightings are dropped -> "unknown"
UTILITY_WINDOW_S = 20.0  # enemy/own utility detonations reported for this long
OBSERVE_RADIUS = 1800  # an own living player must be this close to observe enemy smoke/molotov
SMOKE_FALLBACK_DURATION_S = 18.0  # used only when the parsed event has no expiresTick
RIGHT_NOW_S = 0.5  # sightings this fresh are worded "visible right now"
ECON_MIN_LOSS_STREAK = 2  # inferred "reduced buy" needs at least this many lost rounds in a row ...
ECON_MAX_LOSS_STREAK = 3  # ... and beyond this the buy is too uncertain to infer anything
KILL_FEED_WINDOW_S = 10.0  # kills this recent are restated as facts
PLANT_INFERENCE_WINDOW_S = 10.0  # "someone was at the site moments ago" only holds for a fresh plant
DEFAULT_HALF_ROUNDS = 12  # MR12: used only when the parsed rounds show no half-time swap

# Facts whose text legitimately changes every frame are ignored when diffing views.
DIFF_IGNORED_FACT_PREFIXES = ("clock", "own_", "econ_", "score", "pistol_")
FACT_LIMIT = 200  # fit_text's limit; the domain schema allows 500


def knowledge_view(match: dict[str, Any], round_: dict[str, Any], tick: int, perspective: str) -> KnowledgeView:
    frame_index = frame_index_at(round_, tick)
    if frame_index is None:
        raise ValueError(f"tick {tick} precedes the first frame of round {round_.get('number')}")
    enemy_side = other_side(perspective)
    frames = round_["frames"]
    frame = frames[frame_index]
    t = frame["t"] if frame["tick"] == tick else tick_t(match, round_, tick)
    dead = dead_pids_at(round_, tick)

    own = [
        {**p, "spottedBy": []}  # which enemies can see *us* is not something our team knows
        for p in frame["players"]
        if p["side"] == perspective and p["alive"] and p["pid"] not in dead
    ]
    own_pids = {p["pid"] for p in own}
    enemy_alive_pids = [p["pid"] for p in frame["players"] if p["side"] == enemy_side and p["alive"] and p["pid"] not in dead]

    sightings = _latest_sightings(frames, frame_index, perspective, t)
    enemies: list[KnownEnemy] = []
    for pid in sorted(enemy_alive_pids):
        seen = sightings.get(pid)
        if seen is None:
            enemies.append({"pid": pid, "status": "unknown"})
            continue
        age = round(max(0.0, t - seen["t"]), 1)
        status = "confirmed" if t - seen["t"] <= CONFIRM_WINDOW_S + 1e-6 else "last_seen"
        enemies.append(
            {
                "pid": pid,
                "status": status,
                "place": seen["place"],
                "x": seen["x"],
                "y": seen["y"],
                "ageSeconds": age,
                "weaponSeen": seen["weapon"],
            }
        )

    plant = plant_info(round_, tick)
    bomb = _bomb_knowledge(match, round_, tick, t, perspective, frame, dead, sightings_carrier=_latest_carrier_sighting(frames, frame_index, perspective, t), plant=plant)
    utility = _observed_utility(match, round_, tick, t, perspective)

    plant_t = plant["t"] if plant else None
    clock = {
        "roundSecondsLeft": None if plant else round(max(0.0, round_["roundTimeSeconds"] - t), 1),
        "bombSecondsLeft": round(max(0.0, round_["bombTimerSeconds"] - (t - plant_t)), 1) if plant else None,
    }

    view: KnowledgeView = {
        "perspective": perspective,  # type: ignore[typeddict-item]
        "tick": tick,
        "t": t,
        "clock": clock,
        "alive": {"own": len(own_pids), "enemy": len(enemy_alive_pids)},
        "own": own,
        "enemies": enemies,
        "bomb": bomb,
        "utilityObserved": utility,
        "facts": [],
    }
    view["facts"] = _build_facts(match, round_, view)
    return view


# ---------------------------------------------------------------------------
# Sightings
# ---------------------------------------------------------------------------


def _latest_sightings(frames: list[dict[str, Any]], frame_index: int, perspective: str, t_tick: float) -> dict[str, dict[str, Any]]:
    """Latest sighting per enemy pid at frames <= frame_index, no older than STALE_AFTER_S.

    A sighting needs an own player who is ALIVE in that very frame in the enemy's
    `spottedBy`; a dead observer counts for nothing.
    """
    found: dict[str, dict[str, Any]] = {}
    for index in range(frame_index, -1, -1):
        frame = frames[index]
        if t_tick - frame["t"] > STALE_AFTER_S + 1e-6:
            break
        own_alive = {p["pid"] for p in frame["players"] if p["side"] == perspective and p["alive"]}
        if not own_alive:
            continue
        for player in frame["players"]:
            if player["side"] == perspective or not player["alive"] or player["pid"] in found:
                continue
            if own_alive.intersection(player.get("spottedBy") or ()):
                found[player["pid"]] = {
                    "t": frame["t"],
                    "place": player.get("place"),
                    "x": player["x"],
                    "y": player["y"],
                    "weapon": player.get("activeWeapon"),
                    "hasC4": bool(player.get("hasC4")),
                }
    return found


def _latest_carrier_sighting(frames: list[dict[str, Any]], frame_index: int, perspective: str, t_tick: float) -> dict[str, Any] | None:
    """Latest frame in which the bomb-carrying enemy was seen by a living own player."""
    for index in range(frame_index, -1, -1):
        frame = frames[index]
        if t_tick - frame["t"] > STALE_AFTER_S + 1e-6:
            return None
        own_alive = {p["pid"] for p in frame["players"] if p["side"] == perspective and p["alive"]}
        for player in frame["players"]:
            if player["side"] != perspective and player["alive"] and player.get("hasC4") and own_alive.intersection(player.get("spottedBy") or ()):
                return {"pid": player["pid"], "t": frame["t"], "place": player.get("place"), "x": player["x"], "y": player["y"]}
    return None


# ---------------------------------------------------------------------------
# Bomb
# ---------------------------------------------------------------------------


def _bomb_knowledge(
    match: dict[str, Any],
    round_: dict[str, Any],
    tick: int,
    t: float,
    perspective: str,
    frame: dict[str, Any],
    dead: set[str],
    *,
    sightings_carrier: dict[str, Any] | None,
    plant: dict[str, Any] | None,
) -> KnownBomb:
    if plant is not None:
        result: KnownBomb = {"status": "planted", "knowledge": "confirmed", "place": plant["place"], "site": plant["site"], "ageSeconds": round(max(0.0, t - plant["t"]), 1)}
        return result
    if perspective == "T":
        for player in frame["players"]:
            if player["side"] == "T" and player["alive"] and player["pid"] not in dead and player.get("hasC4"):
                return {"status": "carried", "knowledge": "confirmed", "place": player.get("place")}
        drops = events_of(round_, "bomb_drop", "bomb_pickup", upto=tick)
        if drops and drops[-1]["type"] == "bomb_drop":
            data = drops[-1]["data"]
            return {"status": "dropped", "knowledge": "confirmed", "place": data.get("place"), "ageSeconds": round(max(0.0, t - drops[-1]["t"]), 1)}
        return {"status": "dropped", "knowledge": "confirmed", "place": None}
    # CT: only what was seen. A carrier who has since died is treated as unknown.
    if sightings_carrier is not None and sightings_carrier["pid"] not in dead:
        age = t - sightings_carrier["t"]
        knowledge = "confirmed" if age <= CONFIRM_WINDOW_S + 1e-6 else "last_seen"
        return {
            "status": "carried",
            "knowledge": knowledge,
            "place": sightings_carrier["place"],
            "ageSeconds": round(max(0.0, age), 1),
            "carrierPid": sightings_carrier["pid"],  # an enemy sighting, like `enemies`; never written into fact text
        }
    return {"status": "unknown", "knowledge": "unknown"}


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------


def _observed_utility(match: dict[str, Any], round_: dict[str, Any], tick: int, t: float, perspective: str) -> list[ObservedUtility]:
    out: list[ObservedUtility] = []
    frames = round_["frames"]
    for event in round_["events"]:
        if event["type"] != "utility" or event["tick"] > tick:
            continue
        age = t - event["t"]
        if age > UTILITY_WINDOW_S + 1e-6 or age < 0:
            continue
        data = event["data"]
        kind = data.get("kind")
        side = data.get("side")
        if data.get("x") is None or data.get("y") is None:
            continue
        expires = data.get("expiresTick")
        if kind == "smoke":
            if expires is not None:
                if expires <= tick:
                    continue
            elif age >= SMOKE_FALLBACK_DURATION_S:
                continue
        if side != perspective:
            if kind not in ("smoke", "molotov"):
                continue  # enemy flashes and HE grenades are not reliably observable
            index = frame_index_at(round_, event["tick"])
            if index is None:
                continue
            dead_then = dead_pids_at(round_, event["tick"])
            observers = [
                p
                for p in frames[index]["players"]
                if p["side"] == perspective and p["alive"] and p["pid"] not in dead_then and dist2d(p["x"], p["y"], data["x"], data["y"]) <= OBSERVE_RADIUS
            ]
            if not observers:
                continue
        out.append(
            {
                "kind": kind,
                "side": side,
                "place": data.get("place"),
                "x": int(data["x"]),
                "y": int(data["y"]),
                "ageSeconds": round(max(0.0, age), 1),
            }
        )
    return out


# ---------------------------------------------------------------------------
# Public-information inference
# ---------------------------------------------------------------------------


def enemy_loss_streak(match: dict[str, Any], round_: dict[str, Any], perspective: str) -> tuple[int, list[int]]:
    """Consecutive rounds the enemy team lost immediately before `round_`, within the current half.

    Uses only the public round history (who won each earlier round). Teams are
    tracked by pid because sides swap at half time; a swap ends the streak
    (money resets). Returns (streak length, round numbers).
    """
    rounds = match["rounds"]
    try:
        index = next(i for i, r in enumerate(rounds) if r["number"] == round_["number"])
    except StopIteration:
        return 0, []
    enemy_side = other_side(perspective)
    if not round_["frames"]:
        return 0, []
    enemy_team = {p["pid"] for p in round_["frames"][0]["players"] if p["side"] == enemy_side}
    if not enemy_team:
        return 0, []
    streak: list[int] = []
    for previous in reversed(rounds[:index]):
        if not previous["frames"] or previous["winner"] is None:
            break
        sides = [p["side"] for p in previous["frames"][0]["players"] if p["pid"] in enemy_team]
        if not sides:
            break
        side_then = max(set(sides), key=sides.count)
        if side_then != enemy_side:
            break  # sides swapped: economy reset at half time
        if previous["winner"] == enemy_side:
            break
        streak.append(previous["number"])
    return len(streak), sorted(streak)


# ---------------------------------------------------------------------------
# Facts
# ---------------------------------------------------------------------------


def _fact(fact_id: str, status: str, text: str, basis: str) -> DerivedFact:
    return {"id": fact_id, "status": status, "text": fit_text(text), "basis": basis}  # type: ignore[typeddict-item]


def _group_by_place(enemies: list[KnownEnemy]) -> list[tuple[str | None, list[KnownEnemy]]]:
    groups: dict[str | None, list[KnownEnemy]] = {}
    for enemy in enemies:
        groups.setdefault(enemy.get("place"), []).append(enemy)
    return sorted(groups.items(), key=lambda item: (item[0] is None, item[0] or ""))


def _own_utility_text(own: list[dict[str, Any]]) -> str:
    totals = {kind: sum(p["utility"].get(kind, 0) for p in own) for kind in ("smoke", "flash", "molotov", "he")}
    parts = []
    if totals["smoke"]:
        parts.append(plural(totals["smoke"], "smoke"))
    if totals["flash"]:
        parts.append(plural(totals["flash"], "flash", "flashes"))
    if totals["molotov"]:
        parts.append(plural(totals["molotov"], "molotov"))
    if totals["he"]:
        parts.append(plural(totals["he"], "HE grenade"))
    if not parts:
        return "Your team has no utility left."
    joined = parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]
    return f"Your team has {joined} left."


def _enemy_position_facts(perspective: str, enemies: list[KnownEnemy]) -> list[DerivedFact]:
    """Facts about enemies that are (or were) seen, grouped by place. No identities in the text."""
    enemy_noun = side_word(other_side(perspective))
    enemy_noun_singular = side_word(other_side(perspective), plural=False)
    facts: list[DerivedFact] = []
    confirmed = [e for e in enemies if e["status"] == "confirmed"]
    last_seen = [e for e in enemies if e["status"] == "last_seen"]

    for place, group in _group_by_place(confirmed):
        n = len(group)
        where = pretty_place(place)
        newest = min(e["ageSeconds"] for e in group)
        noun = enemy_noun_singular if n == 1 else enemy_noun
        weapon = weapon_phrase(group[0].get("weaponSeen")) if n == 1 else None
        with_text = f" with {weapon}" if weapon else ""
        if newest <= RIGHT_NOW_S:
            verb = "is" if n == 1 else "are"
            text = f"{number_word(n, capitalise=True)} {noun} {verb} visible in {where} right now{with_text}."
            basis = "spotted by an own living player in the latest frame"
        else:
            verb = "was" if n == 1 else "were"
            text = f"{number_word(n, capitalise=True)} {noun} {verb} spotted in {where} {fmt_seconds(newest)} ago{with_text}."
            basis = f"spotted by an own living player {fmt_seconds(newest)} ago"
        facts.append(_fact(f"visible_{slug(place)}_{n}_{slug(weapon)}", "confirmed", text, basis))

    for place, group in _group_by_place(last_seen):
        n = len(group)
        where = pretty_place(place)
        ages = sorted(e["ageSeconds"] for e in group)
        noun = enemy_noun_singular if n == 1 else enemy_noun
        weapon = weapon_phrase(group[0].get("weaponSeen")) if n == 1 else None
        with_text = f" with {weapon}" if weapon else ""
        verb = "was" if n == 1 else "were"
        if n == 1 or ages[0] == ages[-1]:
            when = f"{fmt_seconds(ages[0])} ago"
        else:
            when = f"{int(round(ages[0]))} to {int(round(ages[-1]))} s ago"
        text = f"{number_word(n, capitalise=True)} {noun} {verb} last seen in {where} {when}{with_text}."
        facts.append(_fact(f"last_seen_{slug(place)}_{n}_{slug(weapon)}", "last_seen", text, f"last spotted by an own player {when}; position may have changed"))
    return facts


def _unknown_fact(perspective: str, unknown: list[KnownEnemy]) -> DerivedFact | None:
    if not unknown:
        return None
    n = len(unknown)
    noun = side_word(other_side(perspective), plural=False) if n == 1 else side_word(other_side(perspective))
    text = f"The position of one {noun} is unknown." if n == 1 else f"The positions of {number_word(n)} {noun} are unknown."
    return _fact(f"unknown_{n}", "unknown", text, "not spotted by a living teammate in the last 45 s (or never this round)")


def _utility_facts(perspective: str, items: list[ObservedUtility]) -> list[DerivedFact]:
    """Facts about enemy utility the team observed (own utility needs no fact: the team threw it)."""
    enemy_noun = side_word(other_side(perspective))
    grouped: dict[tuple[str, str | None], list[float]] = {}
    for item in items:
        if item["side"] != perspective:
            grouped.setdefault((item["kind"], item["place"]), []).append(item["ageSeconds"])
    facts = []
    for (kind, place), ages in sorted(grouped.items(), key=lambda entry: (entry[0][0], entry[0][1] or "")):
        n = len(ages)
        noun = kind if n == 1 else kind + "s"
        when = "just now" if min(ages) < 1.0 else f"{fmt_seconds(min(ages))} ago"
        facts.append(
            _fact(
                f"enemy_{kind}_{slug(place)}_{n}",
                "confirmed",
                f"The {enemy_noun} detonated {'a' if n == 1 else number_word(n)} {noun} in {pretty_place(place)} {when}.",
                f"observed within {OBSERVE_RADIUS} units of a living teammate",
            )
        )
    return facts


def _score_fact(match: dict[str, Any], round_: dict[str, Any], perspective: str) -> DerivedFact | None:
    """Public scoreboard at round start, plus "a win ends the match" when the half length is known."""
    score = round_.get("scoreBefore") or {}
    enemy_side = other_side(perspective)
    if perspective not in score or enemy_side not in score:
        return None
    own, enemy = int(score[perspective]), int(score[enemy_side])
    enemy_noun = side_word(enemy_side)
    text = f"Score: your team {own}, the {enemy_noun} {enemy}."
    swap = halftime_round_number(match)
    half = swap - 1 if swap is not None else (DEFAULT_HALF_ROUNDS if round_["number"] <= DEFAULT_HALF_ROUNDS else None)
    if half is not None and own + enemy < 2 * half:  # regulation only; overtime rules are not modelled
        if own == half:
            text += " A round win ends the match for your team."
        elif enemy == half:
            text += f" A round win ends the match for the {enemy_noun}."
    return _fact("score", "confirmed", text, "public scoreboard")


def _kill_feed_facts(round_: dict[str, Any], view: KnowledgeView, match: dict[str, Any]) -> list[DerivedFact]:
    """Kills of the last KILL_FEED_WINDOW_S seconds as the kill feed shows them to both teams.

    The feed names victim, killer and weapon but never the killer's position. A victim's place is stated
    only when the team itself could place it: an own victim (own radar), an enemy victim that an own
    player killed or that a living own player was seeing just before. No identities, no killer place."""
    perspective = view["perspective"]
    enemy_side = other_side(perspective)
    tick = view["tick"]
    earliest = tick - seconds_to_ticks(match, KILL_FEED_WINDOW_S)
    groups: dict[tuple[bool, str | None], list[tuple[dict[str, Any], float]]] = {}
    for event in kill_events(round_, upto=tick):
        data = event["data"]
        if event["tick"] <= earliest or data.get("weapon") == "planted_c4":
            continue
        victim_side = data.get("victimSide")
        if victim_side == perspective:
            place = data.get("victimPlace")
            key = (True, place)
        elif victim_side == enemy_side:
            placed = data.get("attackerSide") == perspective or _victim_was_seen(round_, event, perspective)
            key = (False, data.get("victimPlace") if placed else None)
        else:
            continue
        groups.setdefault(key, []).append((event, max(0.0, view["t"] - event["t"])))
    facts: list[DerivedFact] = []
    for (own_victim, place), items in sorted(groups.items(), key=lambda kv: (kv[1][0][0]["tick"], kv[0][0])):
        n = len(items)
        ages = sorted(age for _, age in items)
        when = fmt_seconds(ages[0]) + " ago" if ages[0] == ages[-1] else f"{int(round(ages[0]))} to {int(round(ages[-1]))} s ago"
        if own_victim:
            who = "A teammate was" if n == 1 else f"{number_word(n, capitalise=True)} teammates were"
            phrases = sorted({p for p in (weapon_phrase(e["data"].get("weapon")) for e, _ in items) if p})
            by = f" by {' and '.join(phrases)}" if phrases and len(phrases) <= 2 else ""
        else:
            noun = side_word(enemy_side, plural=False) if n == 1 else side_word(enemy_side)
            who = f"{'An' if noun[0] in 'aeiou' else 'A'} {noun} was" if n == 1 else f"{number_word(n, capitalise=True)} {noun} were"
            by = ""
        where = f" in {pretty_place(place)}" if place else ""
        who_slug = "own" if own_victim else "enemy"
        facts.append(
            _fact(
                f"kill_feed_{who_slug}_{slug(place) if place else 'noplace'}_{items[0][0]['tick']}",
                "confirmed",
                f"{who} killed{where} {when}{by}.",
                "kill feed" + (" and own radar" if own_victim else " (place known only because an own player killed or saw the victim)" if place else ""),
            )
        )
    return facts


def _victim_was_seen(round_: dict[str, Any], kill: dict[str, Any], perspective: str) -> bool:
    """A living own player had the victim in view in the CONFIRM_WINDOW_S before the kill."""
    victim = kill["data"].get("victim")
    index = frame_index_at(round_, kill["tick"])
    if index is None:
        return False
    frames = round_["frames"]
    for i in range(index, -1, -1):
        frame = frames[i]
        if kill["t"] - frame["t"] > CONFIRM_WINDOW_S + 1e-6:
            break
        own_alive = {p["pid"] for p in frame["players"] if p["side"] == perspective and p["alive"]}
        for player in frame["players"]:
            if player["pid"] == victim and player["alive"] and own_alive.intersection(player.get("spottedBy") or ()):
                return True
    return False


def _loadout_fact(own: list[dict[str, Any]], place_order: dict[str, int]) -> DerivedFact | None:
    """One fact with every living own player's weapons, HP and armour (the team sees its own buy)."""
    if not own:
        return None
    ordered = sorted(own, key=lambda p: (place_order.get(pretty_place(p.get("place")), 99), p["pid"]))

    def armour(player: dict[str, Any]) -> str:
        if player["armor"] <= 0:
            return "no armour"
        return "full armour" if player.get("helmet") else "armour"

    parts = []
    for player in ordered:
        weapons = " + ".join(w for w in (player.get("primary"), player.get("secondary")) if w) or "knife only"
        parts.append(f"{weapons}, {player['hp']} HP, {armour(player)}")
    long_text = "Your players: " + "; ".join(parts) + "."
    if len(long_text) <= FACT_LIMIT:
        return _fact("own_loadout", "confirmed", long_text, "own team inventory and scoreboard")

    hps = ", ".join(str(p["hp"]) for p in sorted(own, key=lambda p: (-p["hp"], p["pid"])))
    primaries: dict[str, int] = {}
    for player in own:
        if player.get("primary"):
            primaries[player["primary"]] = primaries.get(player["primary"], 0) + 1
    guns = ", ".join(f"{number_word(n)} {name}{'s' if n > 1 else ''}" for name, n in sorted(primaries.items(), key=lambda item: (-item[1], item[0])))
    sidearm_only = sum(1 for p in own if not p.get("primary"))
    if sidearm_only:
        guns = (guns + ", " if guns else "") + f"{number_word(sidearm_only)} without a primary weapon"
    armoured = sum(1 for p in own if p["armor"] > 0)
    vest = "no armour" if not armoured else "all armoured" if armoured == len(own) else f"{number_word(armoured)} armoured"
    text = f"Your players have {hps} HP; {guns}; {vest}."
    return _fact("own_loadout", "confirmed", text, "own team inventory and scoreboard")


def _enemy_heavy_weapons_shown(round_: dict[str, Any], view: KnowledgeView, match: dict[str, Any]) -> bool:
    """True when this round, up to the view tick, the team has seen an enemy rifle or sniper in a sighting,
    or the kill feed showed an enemy kill with a rifle, sniper, SMG, shotgun or machine gun. Either means
    the enemy did not save, so a loss-streak "reduced buy" inference would be contradicted by the team's own
    observation."""
    perspective = view["perspective"]
    enemy_side = other_side(perspective)
    index = frame_index_at(round_, view["tick"])
    if index is None:
        return False
    for frame in round_["frames"][: index + 1]:
        own_alive = {p["pid"] for p in frame["players"] if p["side"] == perspective and p["alive"]}
        if not own_alive:
            continue
        for player in frame["players"]:
            if player["side"] == enemy_side and player["alive"] and own_alive.intersection(player.get("spottedBy") or ()):
                if weapon_class(player.get("activeWeapon")) in ("rifle", "sniper"):
                    return True
    for event in kill_events(round_, upto=view["tick"]):
        data = event["data"]
        if data.get("attackerSide") == enemy_side and weapon_class(data.get("weapon")) in ("rifle", "sniper", "smg", "heavy"):
            return True
    return False


def _merged_carrier(view: KnowledgeView) -> KnownEnemy | None:
    """The enemy sighting that is the same sighting as the bomb carrier's (same pid, same place and age)."""
    bomb = view["bomb"]
    pid = bomb.get("carrierPid")
    if bomb["status"] != "carried" or not pid:
        return None
    for enemy in view["enemies"]:
        if enemy["pid"] == pid and enemy["status"] != "unknown":
            if enemy.get("place") == bomb.get("place") and abs(enemy["ageSeconds"] - bomb.get("ageSeconds", -1.0)) <= 0.05:
                return enemy
    return None


def _build_facts(match: dict[str, Any], round_: dict[str, Any], view: KnowledgeView) -> list[DerivedFact]:
    perspective = view["perspective"]
    enemy_side = other_side(perspective)
    enemy_noun = side_word(enemy_side)
    facts: list[DerivedFact] = []

    own_n, enemy_n = view["alive"]["own"], view["alive"]["enemy"]
    facts.append(
        _fact(
            f"alive_{own_n}v{enemy_n}",
            "confirmed",
            f"{plural(own_n, perspective)} alive against {plural(enemy_n, enemy_side)}.",
            "HUD alive count",
        )
    )
    score = _score_fact(match, round_, perspective)
    if score:
        facts.append(score)
    if is_pistol_round(match, round_):
        facts.append(_fact("pistol_round", "confirmed", "This is the first round of the half (pistol round).", "round number"))

    carrier = _merged_carrier(view)
    facts.extend(_bomb_facts(view, carrier))
    bomb = view["bomb"]
    if perspective == "CT" and bomb["status"] == "planted" and bomb.get("ageSeconds") is not None and bomb["ageSeconds"] <= PLANT_INFERENCE_WINDOW_S:
        where = f"at site {bomb['site']}" if bomb.get("site") else f"in {pretty_place(bomb['place'])}" if bomb.get("place") else None
        if where:
            ago = "was just planted" if bomb["ageSeconds"] < 1.0 else f"was planted {fmt_seconds(bomb['ageSeconds'])} ago"
            facts.append(
                _fact(
                    "plant_inference",
                    "inferred",
                    f"The bomb {ago}, so at least one attacker was {where} moments ago.",
                    "plant announcement",
                )
            )
    facts.append(_fact("own_utility", "confirmed", _own_utility_text(view["own"]), "own team inventory"))

    place_counts: dict[str, int] = {}
    for player in view["own"]:
        label = pretty_place(player.get("place"))
        place_counts[label] = place_counts.get(label, 0) + 1
    place_order: dict[str, int] = {}
    if place_counts:
        ranked = sorted(place_counts.items(), key=lambda item: (-item[1], item[0]))
        place_order = {label: rank for rank, (label, _) in enumerate(ranked)}
        listing = ", ".join(f"{n} in {label}" for label, n in ranked)
        facts.append(_fact("own_positions", "confirmed", f"Your team is positioned: {listing}.", "own team positions on the radar"))
    loadout = _loadout_fact(view["own"], place_order)
    if loadout:
        facts.append(loadout)

    sighted = [e for e in view["enemies"] if carrier is None or e["pid"] != carrier["pid"]]
    facts.extend(_enemy_position_facts(perspective, sighted))
    facts.extend(_kill_feed_facts(round_, view, match))
    unknown = _unknown_fact(perspective, [e for e in view["enemies"] if e["status"] == "unknown"])
    if unknown:
        facts.append(unknown)
    facts.extend(_utility_facts(perspective, view["utilityObserved"]))

    streak, rounds = enemy_loss_streak(match, round_, perspective)
    if ECON_MIN_LOSS_STREAK <= streak <= ECON_MAX_LOSS_STREAK and not _enemy_heavy_weapons_shown(round_, view, match):
        facts.append(
            _fact(
                "econ_enemy_reduced",
                "inferred",
                f"The {enemy_noun} have lost {streak} rounds in a row, so they are likely on a reduced buy.",
                f"public scoreboard: {enemy_side} lost rounds {', '.join(str(n) for n in rounds)} of this half",
            )
        )
    return facts


def _bomb_facts(view: KnowledgeView, carrier: KnownEnemy | None = None) -> list[DerivedFact]:
    perspective = view["perspective"]
    bomb = view["bomb"]
    clock = view["clock"]
    if bomb["status"] == "planted":
        site = bomb.get("site")
        where = f"at {site}" if site else f"in {pretty_place(bomb.get('place'))}"
        left = clock["bombSecondsLeft"]
        text = f"The bomb is planted {where}; {int(round(left))} s remain on the bomb timer." if left is not None else f"The bomb is planted {where}."
        return [_fact(f"bomb_planted_{slug(site or bomb.get('place'))}", "confirmed", text, "bomb plant announcement and bomb timer HUD")]
    facts: list[DerivedFact] = []
    left = clock["roundSecondsLeft"]
    if left is not None:
        facts.append(_fact("clock", "confirmed", f"The bomb has not been planted; about {int(round(left))} s remain on the round clock.", "HUD round clock"))
    if bomb["status"] == "carried" and perspective == "T":
        facts.append(_fact("bomb_carried_own", "confirmed", f"Your team is carrying the bomb in {pretty_place(bomb.get('place'))}.", "own team inventory"))
    elif bomb["status"] == "dropped" and perspective == "T":
        where = f" in {pretty_place(bomb['place'])}" if bomb.get("place") else ""
        facts.append(_fact("bomb_dropped_own", "confirmed", f"The bomb is on the ground{where}.", "bomb icon on the T radar"))
    elif bomb["status"] == "carried":
        place = pretty_place(bomb.get("place"))
        age = bomb["ageSeconds"]
        fact_id = f"bomb_carrier_{slug(bomb.get('place'))}"  # same id while the sighting merely ages
        # When the carrier is also a sighted enemy, the weapon belongs to this fact and the enemy is not
        # repeated among the grouped sightings.
        weapon = weapon_phrase(carrier.get("weaponSeen")) if carrier else None
        with_text = f" with {weapon}" if weapon else ""
        if bomb["knowledge"] == "confirmed" and age <= RIGHT_NOW_S:
            facts.append(_fact(fact_id, "confirmed", f"The bomb carrier is visible in {place} right now{with_text}.", "spotted by an own living player in the latest frame"))
        elif bomb["knowledge"] == "confirmed":
            facts.append(_fact(fact_id, "confirmed", f"The bomb carrier was spotted in {place} {fmt_seconds(age)} ago{with_text}.", f"spotted by an own living player {fmt_seconds(age)} ago"))
        else:
            facts.append(_fact(fact_id, "last_seen", f"The bomb carrier was last seen in {place} {fmt_seconds(age)} ago{with_text}.", f"spotted by an own player {fmt_seconds(age)} ago"))
    else:
        facts.append(_fact("bomb_unknown", "unknown", "The bomb carrier has not been located.", "no living teammate has seen the bomb carrier recently"))
    return facts


def new_facts(before: KnowledgeView, after: KnowledgeView) -> list[DerivedFact]:
    """What the team learned between two views (player-known wording only).

    Compared by meaning, not by text: an enemy who merely ages from "visible" to "last seen" at the
    same place, or a smoke that expires, is not news. Own-team facts and the clock never count.
    """
    perspective = after["perspective"]
    known_ids = {fact["id"] for fact in before["facts"]}
    out: list[DerivedFact] = []

    for fact in after["facts"]:
        prefix_ignored = fact["id"].startswith(DIFF_IGNORED_FACT_PREFIXES)
        is_position_or_utility = fact["id"].startswith(("visible_", "last_seen_", "enemy_", "unknown_"))
        if fact["id"] in known_ids or prefix_ignored or is_position_or_utility:
            continue
        out.append(fact)

    previous = {e["pid"]: e for e in before["enemies"]}
    rank = {"unknown": 0, "last_seen": 1, "confirmed": 2}
    changed: list[KnownEnemy] = []
    for enemy in after["enemies"]:
        if enemy["status"] == "unknown":
            continue
        old = previous.get(enemy["pid"])
        if old is None or old["status"] == "unknown":
            changed.append(enemy)
        elif enemy["status"] == "confirmed" and old["status"] != "confirmed":
            changed.append(enemy)
        elif old.get("place") != enemy.get("place") and enemy["status"] == "confirmed":
            changed.append(enemy)
        elif old.get("place") != enemy.get("place") and rank[enemy["status"]] >= rank[old["status"]]:
            changed.append(enemy)
    carrier = _merged_carrier(after)
    out.extend(_enemy_position_facts(perspective, [e for e in changed if carrier is None or e["pid"] != carrier["pid"]]))

    unknown_after = _unknown_fact(perspective, [e for e in after["enemies"] if e["status"] == "unknown"])
    if unknown_after and unknown_after["id"] not in known_ids:
        out.append(unknown_after)

    seen_before = {(u["kind"], u["place"], u["x"], u["y"]) for u in before["utilityObserved"]}
    out.extend(_utility_facts(perspective, [u for u in after["utilityObserved"] if (u["kind"], u["place"], u["x"], u["y"]) not in seen_before]))
    return out
