"""Mining pipeline: parsed match -> ranked candidate directories.

    data-local/candidates/<source-id>/<candidate-id>/candidate.json
    data-local/candidates/<source-id>/index.json      (sorted by score, best first)

Candidate ids are stable across re-runs (model.candidate_id) and all JSON is
written with sorted keys, so re-mining an unchanged match is byte-identical.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

from .. import paths
from ..model import SCHEMA_VERSION, Candidate, candidate_id, read_json, write_json
from .common import (
    alive_counts,
    events_of,
    fmt_seconds,
    kill_events,
    number_word,
    other_side,
    players_at,
    plural,
    pretty_place,
    seconds_to_ticks,
    tick_t,
    true_bomb_state,
    weapon_phrase,
)
from .detectors import dedupe_and_cap, detect_decisions
from .followup import find_followup
from .knowledge import knowledge_view
from .scoring import relevant_clock, score_candidate

TIMELINE_WINDOW_S = 20.0
TIMELINE_AFTER_MAX_EVENTS = 20  # real events; the round_end pseudo-event comes on top
ACTUAL_LINE_MOVE_S = 10.0
STALE_NOTE_AFTER_S = 8.0

CATEGORY_LABELS = {
    "post_plant": {"CT": "Post-plant retake", "T": "Post-plant defence"},
    "opening_pick": "After the opening kill",
    "man_advantage_shift": "After a trade",
    "late_round_no_plant": "Late round, no plant",
    "rotation_read": "Rotation read",
    "low_utility_attack": "Low-utility attack",
    "economy_save": "Save or attempt",
}

CATEGORY_CAVEATS = {
    "post_plant": "Post-plant: the bomb timer, not the round clock, is the deadline; whether to retake or save depends on information the demo cannot show about the enemy's utility.",
    "opening_pick": "Opening pick: the state right after the first kill is shaped by the first minute's utility and positions, which the brief only summarises.",
    "man_advantage_shift": "Man-advantage shift: kills leave several defensible follow-ups (trade, hold, rotate); the detector does not judge which is best.",
    "late_round_no_plant": "Late round with no plant: the attackers' options depend on how much of the round clock they are willing to spend, which is a judgement call.",
    "rotation_read": "Rotation read: the detector uses site geometry taken from the demo itself; the choice to rotate is disputed by nature.",
    "low_utility_attack": "Low-utility attack: utility counts are exact for the team but the enemy's reaction to a light execute is unknown to the attackers.",
    "economy_save": "Save or attempt: saving is only meaningful when the round is lost in practice; 'attempt' lines can be defensible for individual players.",
}


# ---------------------------------------------------------------------------
# Ground-truth descriptions (reviewer-only; pids, never names)
# ---------------------------------------------------------------------------


def describe_event(event: dict[str, Any]) -> str:
    data = event["data"]
    kind = event["type"]
    if kind == "kill":
        attacker = data.get("attacker")
        if not data.get("victim"):
            return "a kill the parser could not attribute"
        weapon = f" with {data['weapon']}" if data.get("weapon") else ""
        head = " (headshot)" if data.get("headshot") else ""
        who = f"{attacker} ({data.get('attackerSide')})" if attacker else "an unattributed source"
        return f"{who} killed {data.get('victim')} ({data.get('victimSide')}){weapon}{head} in {pretty_place(data.get('victimPlace'))}"
    if kind == "utility":
        return f"{data.get('thrower')} ({data.get('side')}) detonated a {data.get('kind')} in {pretty_place(data.get('place'))}"
    place = pretty_place(data.get("place"))
    site = f" at {data['site']}" if data.get("site") else f" in {place}"
    player = data.get("player") or "someone"
    return {
        "bomb_pickup": f"{player} picked up the bomb in {place}",
        "bomb_drop": f"{player} dropped the bomb in {place}",
        "bomb_plant_begin": f"{player} began planting{site}",
        "bomb_planted": f"{player} planted the bomb{site}",
        "bomb_defuse_begin": f"{player} began defusing{site}",
        "bomb_defused": f"{player} defused the bomb{site}",
        "bomb_exploded": f"the bomb exploded{site}",
    }.get(kind, kind)


def _timeline(match: dict[str, Any], round_: dict[str, Any], lo: int, hi: int, decision_t: float, *, include_lo: bool) -> list[dict[str, Any]]:
    out = []
    for event in round_["events"]:
        inside = (lo <= event["tick"] if include_lo else lo < event["tick"]) and event["tick"] <= hi
        if inside:
            out.append(
                {
                    "tick": event["tick"],
                    "t": event["t"],
                    "offsetSeconds": round(event["t"] - decision_t, 2),
                    "type": event["type"],
                    "description": describe_event(event),
                }
            )
    return out


_END_REASONS = {
    "t_win_elimination": "The attackers win: all defenders eliminated.",
    "ct_win_elimination": "The defenders win: all attackers eliminated.",
    "bomb_defused": "The bomb is defused.",
    "target_bombed": "The bomb explodes.",
    "bomb_exploded": "The bomb explodes.",
    "time_ran_out": "Time runs out.",
    "target_saved": "Time runs out.",
}


def describe_round_end(round_: dict[str, Any]) -> str:
    reason = str(round_.get("endReason"))
    if reason in _END_REASONS:
        return _END_REASONS[reason]
    winner = round_.get("winner")
    return f"The {'attackers' if winner == 'T' else 'defenders'} win the round." if winner in ("T", "CT") else "The round ends."


def _timeline_after(match: dict[str, Any], round_: dict[str, Any], tick: int, decision_t: float) -> list[dict[str, Any]]:
    """Everything after the decision until the round ends, at most TIMELINE_AFTER_MAX_EVENTS real events
    (utility is dropped first, latest first) and a final round_end pseudo-event. Reviewer-only, pid wording."""
    events = _timeline(match, round_, tick, 10**12, decision_t, include_lo=False)
    if len(events) > TIMELINE_AFTER_MAX_EVENTS:
        important = [e for e in events if e["type"] != "utility"]
        room = max(0, TIMELINE_AFTER_MAX_EVENTS - len(important))
        keep_util = [e for e in events if e["type"] == "utility"][:room]
        events = sorted(important[:TIMELINE_AFTER_MAX_EVENTS] + keep_util, key=lambda e: (e["tick"], e["type"]))
    end_tick = max([round_["endTick"], tick] + [e["tick"] for e in events])
    end_t = tick_t(match, round_, end_tick)
    events.append(
        {
            "tick": end_tick,
            "t": end_t,
            "offsetSeconds": round(end_t - decision_t, 2),
            "type": "round_end",
            "description": describe_round_end(round_),
        }
    )
    return events


def _outcome(match: dict[str, Any], round_: dict[str, Any], perspective: str) -> dict[str, Any]:
    if events_of(round_, "bomb_exploded"):
        bomb = "exploded"
    elif events_of(round_, "bomb_defused"):
        bomb = "defused"
    elif events_of(round_, "bomb_planted"):
        bomb = "planted"
    else:
        bomb = "not_planted"
    own = enemy = 0
    if round_["frames"]:
        _, players = players_at(round_, round_["endTick"])
        own, enemy = alive_counts(players, perspective)
    return {
        "winner": round_["winner"],
        "endReason": round_["endReason"],
        "bombOutcome": bomb,
        "ownSurvivors": own,
        "enemySurvivors": enemy,
        "perspectiveWon": round_["winner"] == perspective,
    }


def _actual_line(match: dict[str, Any], round_: dict[str, Any], tick: int, perspective: str) -> str:
    t0 = tick_t(match, round_, tick)
    _, start_players = players_at(round_, tick)
    own_start = {p["pid"]: p for p in start_players if p["side"] == perspective and p["alive"]}
    move_tick = min(tick + seconds_to_ticks(match, ACTUAL_LINE_MOVE_S), round_["endTick"])
    _, later_players = players_at(round_, move_tick)
    later = {p["pid"]: p for p in later_players}
    deaths = {
        e["data"]["victim"]: e
        for e in kill_events(round_)
        if tick < e["tick"] <= move_tick and e["data"].get("victim") in own_start
    }
    stayed: dict[str, int] = {}
    moved: dict[tuple[str, str], int] = {}
    fell: list[str] = []
    for pid, before in sorted(own_start.items()):
        if pid in deaths:
            event = deaths[pid]
            fell.append(f"one player was killed in {pretty_place(event['data'].get('victimPlace'))} after {fmt_seconds(event['t'] - t0)}")
            continue
        after = later[pid]
        if after.get("place") == before.get("place"):
            stayed[pretty_place(before.get("place"))] = stayed.get(pretty_place(before.get("place")), 0) + 1
        else:
            key = (pretty_place(before.get("place")), pretty_place(after.get("place")))
            moved[key] = moved.get(key, 0) + 1
    parts = []
    if stayed:
        held = sum(stayed.values())
        places = sorted(stayed)
        listing = places[0] if len(places) == 1 else ", ".join(places[:-1]) + " and " + places[-1]
        parts.append(f"{plural(held, 'player')} held position in {listing}")
    parts += [f"{plural(n, 'player')} moved from {a} to {b}" for (a, b), n in sorted(moved.items())]
    parts += fell
    seconds = int(round((move_tick - tick) / match["tickrate"]))

    window_end = tick + seconds_to_ticks(match, TIMELINE_WINDOW_S)
    used: dict[str, int] = {}
    for event in round_["events"]:
        if event["type"] == "utility" and event["data"].get("side") == perspective and tick < event["tick"] <= window_end:
            used[event["data"]["kind"]] = used.get(event["data"]["kind"], 0) + 1
    utility_text = ", ".join(plural(n, kind, "flashes" if kind == "flash" else None) for kind, n in sorted(used.items())) or "no utility"
    got = sum(1 for e in kill_events(round_) if tick < e["tick"] <= window_end and e["data"].get("victimSide") == other_side(perspective))
    lost = sum(1 for e in kill_events(round_) if tick < e["tick"] <= window_end and e["data"].get("victimSide") == perspective)
    fight = "took no fight" if not got and not lost else f"got {plural(got, 'kill') if got else 'no kills'} and lost {plural(lost, 'player') if lost else 'no players'}"
    bomb_events = [e for e in round_["events"] if tick < e["tick"] <= window_end and e["type"] in ("bomb_planted", "bomb_defuse_begin", "bomb_defused", "bomb_exploded")]
    bomb_text = ""
    if bomb_events:
        bomb_text = " Bomb: " + "; ".join(describe_event(e).replace(str(e["data"].get("player")), "a player") for e in bomb_events) + "."
    outcome = _outcome(match, round_, perspective)
    result = f"{round_['winner']} won the round ({str(round_['endReason']).replace('_', ' ')})" if round_["winner"] else "the round had no winner recorded"
    return (
        "HISTORICAL LINE (what this team actually did; it is not assumed to be the correct line). "
        f"Over the next {seconds} s: {'; '.join(parts) if parts else 'no own players were alive'}. "
        f"Over the next {int(TIMELINE_WINDOW_S)} s the team used {utility_text} and {fight}.{bomb_text} "
        f"Result: {result}; {outcome['ownSurvivors']} of the team survived."
    )


def _summary(category: str, view: dict[str, Any]) -> str:
    perspective = view["perspective"]
    label = CATEGORY_LABELS[category]
    if isinstance(label, dict):
        label = label[perspective]
    own, enemy = view["alive"]["own"], view["alive"]["enemy"]
    left = relevant_clock(view)
    if view["clock"]["bombSecondsLeft"] is not None:
        site = view["bomb"].get("site")
        clock = f"{int(round(left))} s on the bomb" + (f" at {site}" if site else "")
    else:
        clock = f"{int(round(left))} s on the round clock" if left is not None else "clock unknown"
    counts = {"confirmed": 0, "last_seen": 0, "unknown": 0}
    for enemy_state in view["enemies"]:
        counts[enemy_state["status"]] += 1
    known = ", ".join(f"{n} {name.replace('_', ' ')}" for name, n in counts.items() if n)
    return f"{label} ({perspective}): {own}v{enemy}, {clock}; enemies {known}."


def _review_notes(category: str, view: dict[str, Any], followup: dict[str, Any] | None, detail: dict[str, Any]) -> list[str]:
    notes = [
        "Team comms may have provided information the demo cannot show (callouts, sound cues, teammates' kill positions).",
        "The historical line is not assumed to be correct; it only records what this team did.",
        "Sightings come from the demo's spotted flag, which can register enemies a player never consciously noticed.",
        "Detected by a heuristic; not yet reviewed by a human CS2 reviewer.",
        CATEGORY_CAVEATS.get(category, ""),
    ]
    for enemy in view["enemies"]:
        if enemy["status"] == "last_seen" and enemy["ageSeconds"] >= STALE_NOTE_AFTER_S:
            gun = weapon_phrase(enemy.get("weaponSeen"))
            weapon = f" (last seen with {gun})" if gun else ""
            notes.append(f"The last sighting of an enemy in {pretty_place(enemy.get('place'))}{weapon} is {fmt_seconds(enemy['ageSeconds'])} old, so that position may be stale.")
    if any(f["id"].startswith("econ_") for f in view["facts"]):
        notes.append("The enemy economy is inferred from the public round history; the actual buy is not known to the team.")
    if abs(view["alive"]["own"] - view["alive"]["enemy"]) >= 3:
        notes.append("The alive counts are lopsided, so the state may already be decided in practice.")
    if followup is not None and followup.get("dependsOnOwnMovement"):
        notes.append("The follow-up sighting exists because the source team moved into position; a team that chose another line would not see it at this moment.")
    reaction = followup.get("reactionWindowSeconds") if followup else None
    if reaction is not None and reaction < 2:
        notes.append("The follow-up information arrives less than 2 s before the next kill, leaving almost no time to react.")
    if followup is None:
        notes.append("No material follow-up was found 3-25 s after the decision; a follow-up would have to be authored by hand.")
    else:
        notes.append("The follow-up is the first material change the demo shows 3-25 s later; teams may have learned of it earlier through comms.")
    if detail.get("enemiesNear"):
        notes.append(f"Rotation read: {number_word(detail['enemiesNear'])} enemies were confirmed near site {detail.get('site')} while {plural(detail['ctsElsewhere'], 'player')} of the team {'was' if detail['ctsElsewhere'] == 1 else 'were'} far from it.")
    return [n for n in notes if n]


# ---------------------------------------------------------------------------
# Candidate assembly
# ---------------------------------------------------------------------------


def build_candidate(match: dict[str, Any], manifest: dict[str, Any] | None, round_: dict[str, Any], decision: dict[str, Any]) -> Candidate:
    tick, perspective, category = decision["tick"], decision["perspective"], decision["category"]
    view = knowledge_view(match, round_, tick, perspective)
    followup = find_followup(match, round_, tick, perspective)
    score = score_candidate(match, round_, category, view, followup)
    t0 = view["t"]
    frame, players = players_at(round_, tick)
    window = seconds_to_ticks(match, TIMELINE_WINDOW_S)
    ground_truth: dict[str, Any] = {
        "enemies": [p for p in players if p["side"] == other_side(perspective)],
        "bomb": true_bomb_state(round_, tick),
        "timelineBefore": _timeline(match, round_, tick - window, tick, t0, include_lo=True),
        "timelineAfter": _timeline_after(match, round_, tick, t0),
        "outcome": _outcome(match, round_, perspective),
        "detectorDetail": decision.get("detail", {}),
    }
    if manifest:
        ground_truth["source"] = {
            "sourceId": manifest.get("sourceId"),
            "contentLane": manifest.get("rights", {}).get("contentLane"),
            "provenanceNote": manifest.get("rights", {}).get("provenanceNote"),
        }
    return {
        "schemaVersion": SCHEMA_VERSION,
        "candidateId": candidate_id(match["demoSha256"], round_["number"], tick, perspective, category),
        "sourceId": match["sourceId"],
        "map": match["map"],
        "round": round_["number"],
        "decisionTick": tick,
        "decisionT": t0,
        "perspective": perspective,
        "category": category,
        "summary": _summary(category, view),
        "score": score,
        "playerKnown": view,
        "followUp": followup,
        "groundTruth": ground_truth,
        "actualLine": _actual_line(match, round_, tick, perspective),
        "reviewNotes": _review_notes(category, view, followup, decision.get("detail", {})),
    }


def mine_match(match: dict[str, Any], manifest: dict[str, Any] | None = None, *, min_score: float = 0.0,
               cap: int | None = None) -> list[Candidate]:
    rounds = {r["number"]: r for r in match["rounds"]}
    built = []
    for decision in detect_decisions(match):
        candidate = build_candidate(match, manifest, rounds[decision["round"]], decision)
        built.append(candidate)
    ranked = [
        {"round": c["round"], "tick": c["decisionTick"], "t": c["decisionT"], "perspective": c["perspective"], "category": c["category"], "score": c["score"]["total"], "candidate": c}
        for c in built
    ]
    kept = dedupe_and_cap(ranked) if cap is None else dedupe_and_cap(ranked, cap=cap)
    result = [item["candidate"] for item in kept if item["score"] >= min_score]
    return sorted(result, key=lambda c: (-c["score"]["total"], c["round"], c["decisionTick"], c["perspective"], c["category"]))


def _index_row(candidate: Candidate) -> dict[str, Any]:
    return {
        "candidateId": candidate["candidateId"],
        "id": candidate["candidateId"],
        "sourceId": candidate["sourceId"],
        "map": candidate["map"],
        "round": candidate["round"],
        "tick": candidate["decisionTick"],
        "perspective": candidate["perspective"],
        "category": candidate["category"],
        "score": candidate["score"]["total"],
        "summary": candidate["summary"],
    }


def mine_source(source_id: str, *, min_score: float = 0.0, cap: int | None = None) -> list[Path]:
    match_path = paths.parsed_dir(source_id) / "match.json"
    if not match_path.exists():
        raise FileNotFoundError(f"Parsed match missing: {match_path}")
    match = read_json(match_path)
    manifest_path = paths.manifests_dir() / f"{source_id}.json"
    manifest = read_json(manifest_path) if manifest_path.exists() else None

    candidates = mine_match(match, manifest, min_score=min_score, cap=cap)
    out_dir = paths.candidates_dir(source_id)
    written = []
    for candidate in candidates:
        path = out_dir / candidate["candidateId"] / "candidate.json"
        write_json(path, candidate)
        written.append(path)
    keep = {c["candidateId"] for c in candidates}
    if out_dir.exists():
        for child in out_dir.iterdir():
            if child.is_dir() and child.name.startswith("cand_") and child.name not in keep and [p.name for p in child.iterdir()] == ["candidate.json"]:
                shutil.rmtree(child)  # stale output of an earlier run, nothing else lives there
    write_json(out_dir / "index.json", [_index_row(c) for c in candidates])
    return written


def list_candidates(
    source_ids: list[str] | None = None,
    map_name: str | None = None,
    min_score: float = 0.0,
    category: str | None = None,
) -> list[dict[str, Any]]:
    root = paths.data_root() / "candidates"
    rows: list[dict[str, Any]] = []
    if not root.exists():
        return rows
    for source_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        if source_ids is not None and source_dir.name not in source_ids:
            continue
        index_path = source_dir / "index.json"
        if not index_path.exists():
            continue
        for row in read_json(index_path):
            row = {**row, "sourceId": row.get("sourceId", source_dir.name)}
            if map_name and row.get("map") != map_name:
                continue
            if row["score"] < min_score:
                continue
            if category and row["category"] != category:
                continue
            rows.append(row)
    return sorted(rows, key=lambda r: (-r["score"], r["sourceId"], r["round"], r["tick"], r["perspective"]))
