"""Independent leak audit over the real parsed demos (skipped when data-local has none).

The audit re-derives every claimed sighting straight from the raw frames, without
using roundcraft_miner.mine.knowledge, and fails if a candidate's player-known
view (or its follow-up view) contains anything the team could not have known.
"""

from __future__ import annotations

import json

import pytest

from roundcraft_miner import paths
from roundcraft_miner.mine.pipeline import mine_match
from roundcraft_miner.model import read_json

SOURCES = ["src_mirage_mm_demoparser_test", "src_inferno_cs2_test_20230901"]


def _load(source_id):
    path = paths.parsed_dir(source_id) / "match.json"
    if not path.exists():
        pytest.skip(f"no parsed match for {source_id}")
    return read_json(path)


def _audit_view(match, round_, view):
    tick, perspective = view["tick"], view["perspective"]
    frames = [f for f in round_["frames"] if f["tick"] <= tick]
    assert frames, "view built from a tick before any frame"
    latest = frames[-1]
    kills = [e for e in round_["events"] if e["type"] == "kill" and e["tick"] <= tick]
    dead = {e["data"]["victim"] for e in kills}
    enemy_alive = {p["pid"] for p in latest["players"] if p["side"] != perspective and p["alive"] and p["pid"] not in dead}
    assert {e["pid"] for e in view["enemies"]} == enemy_alive
    assert view["alive"]["enemy"] == len(enemy_alive)
    assert all(p["spottedBy"] == [] and p["side"] == perspective and p["alive"] for p in view["own"])
    for enemy in view["enemies"]:
        if enemy["status"] == "unknown":
            assert set(enemy) == {"pid", "status"}
            continue
        # A sighting frame must exist: enemy alive there, spotted by an own player alive there, same coordinates.
        candidates = []
        for frame in frames:
            own_alive = {p["pid"] for p in frame["players"] if p["side"] == perspective and p["alive"]}
            for p in frame["players"]:
                if p["pid"] == enemy["pid"] and p["alive"] and own_alive & set(p["spottedBy"]):
                    candidates.append((frame, p))
        assert candidates, f"{enemy} has no sighting at or before tick {tick}"
        frame, p = candidates[-1]
        assert (enemy["x"], enemy["y"], enemy["place"]) == (p["x"], p["y"], p["place"])
        age = view["t"] - frame["t"]
        assert abs(enemy["ageSeconds"] - age) <= 0.11
        assert age <= 45.0 + 1e-6
        assert (enemy["status"] == "confirmed") == (age <= 2.0 + 1e-6)
    # Every fact: no pids in text, lengths within the Roundcraft limits.
    for fact in view["facts"]:
        assert 8 <= len(fact["text"]) <= 200
        assert not any(pid in fact["text"] for pid in match["players"])
    # Nothing from after the tick.
    for item in view["utilityObserved"]:
        assert item["ageSeconds"] >= 0
    if perspective == "CT" and view["bomb"]["status"] != "planted":
        assert view["bomb"]["knowledge"] in ("confirmed", "last_seen", "unknown")


@pytest.mark.parametrize("source_id", SOURCES)
def test_no_candidate_view_leaks_ground_truth(source_id):
    match = _load(source_id)
    rounds = {r["number"]: r for r in match["rounds"]}
    candidates = mine_match(match)
    assert candidates
    for candidate in candidates:
        round_ = rounds[candidate["round"]]
        _audit_view(match, round_, candidate["playerKnown"])
        follow = candidate["followUp"]
        if follow:
            assert follow["tick"] > candidate["decisionTick"]
            assert 3.0 - 0.05 <= follow["t"] - candidate["decisionT"] <= 25.0 + 0.05
            _audit_view(match, round_, follow["knowledgeAfter"])
        # The brief-facing view must not contain any enemy that the audit says is unknown with coordinates.
        blob = json.dumps({"known": candidate["playerKnown"], "follow": follow})
        assert "spottedBy\": [\"" not in blob or all(p["spottedBy"] == [] for p in candidate["playerKnown"]["own"])


@pytest.mark.parametrize("source_id", SOURCES)
def test_mining_real_match_is_deterministic(source_id):
    match = _load(source_id)
    first = json.dumps(mine_match(match), sort_keys=True)
    second = json.dumps(mine_match(match), sort_keys=True)
    assert first == second
