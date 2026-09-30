"""Normalisation tests. The real-demo tests need the local Mirage demo (git-ignored) and are skipped without it."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from roundcraft_miner import paths
from roundcraft_miner.model import write_json
from roundcraft_miner.parse.normalise import NormaliseError, normalise_demo, parse_source
from roundcraft_miner.sources import manifest as mf

MIRAGE = Path(paths.REPO_ROOT) / "data-local" / "demos" / "src_mirage_mm_demoparser_test.dem"
needs_mirage = pytest.mark.skipif(not MIRAGE.exists(), reason="local Mirage demo not present")
SHA = "0" * 64


@pytest.fixture(scope="module")
def mirage():
    return normalise_demo(MIRAGE, source_id="src_mirage_mm_demoparser_test", demo_sha256=SHA)


def _dump(match) -> str:
    return json.dumps(match, sort_keys=True, ensure_ascii=False)


@needs_mirage
def test_mirage_structure(mirage):
    assert mirage["map"] == "de_mirage"
    assert mirage["tickrate"] == 64
    assert mirage["sampleEveryTicks"] == 32
    assert mirage["players"] == [f"p{i:02d}" for i in range(1, 11)]
    # The demo holds 10 round_end events, but the 10th is a CT surrender during freeze time
    # (no live play, no freeze_end) and is dropped with a warning.
    assert len(mirage["rounds"]) == 9
    assert any("no freeze_end" in w for w in mirage.get("warnings", []))
    assert [r["number"] for r in mirage["rounds"]] == list(range(1, 10))
    first = mirage["rounds"][0]
    assert first["scoreBefore"] == {"T": 0, "CT": 0}
    assert first["winner"] == "T" and first["endReason"] == "t_win_elimination"
    assert mirage["rounds"][1]["endReason"] == "bomb_defused"
    assert mirage["rounds"][1]["scoreBefore"] == {"T": 1, "CT": 0}
    assert first["roundTimeSeconds"] == 115.0 and first["bombTimerSeconds"] == 40.0
    for rnd in mirage["rounds"]:
        assert rnd["frames"][0]["t"] >= 0
        assert rnd["frames"][-1]["tick"] <= rnd["endTick"]
        keys = [(e["tick"], e["type"]) for e in rnd["events"]]
        assert keys == sorted(keys)


@needs_mirage
def test_mirage_frames_have_ten_sorted_players_and_enemy_only_spotters(mirage):
    for rnd in mirage["rounds"]:
        ticks = [f["tick"] for f in rnd["frames"]]
        assert ticks == sorted(set(ticks))
        for frame in rnd["frames"]:
            pids = [p["pid"] for p in frame["players"]]
            assert pids == mirage["players"]
            side = {p["pid"]: p["side"] for p in frame["players"]}
            for p in frame["players"]:
                for spotter in p["spottedBy"]:
                    assert side[spotter] != p["side"]
                assert p["spottedBy"] == sorted(p["spottedBy"])
                if not p["alive"]:
                    assert p["hp"] == 0
    # sampling cadence: interior frames are 32 ticks apart on a 1-tick recording
    interior = [b["tick"] - a["tick"] for a, b in zip(mirage["rounds"][0]["frames"], mirage["rounds"][0]["frames"][1:])]
    assert set(interior[:-1]) == {32}


@needs_mirage
def test_mirage_events_reference_known_pids(mirage):
    pids = set(mirage["players"])
    kinds = set()
    for rnd in mirage["rounds"]:
        for ev in rnd["events"]:
            kinds.add(ev["type"])
            d = ev["data"]
            assert rnd["freezeEndTick"] <= ev["tick"] <= rnd["endTick"]
            for key in ("attacker", "victim", "assister", "thrower", "player"):
                if d.get(key) is not None:
                    assert d[key] in pids
            if ev["type"] == "kill":
                assert d["attribution"] == "event" and d["victim"] is not None
            if ev["type"] == "utility":
                assert d["kind"] in {"smoke", "flash", "he", "molotov", "decoy"}
    assert {"kill", "utility", "bomb_planted", "bomb_defused", "bomb_exploded"} <= kinds


@needs_mirage
def test_mirage_has_no_identifying_data(mirage):
    from demoparser2 import DemoParser

    text = _dump({k: v for k, v in mirage.items() if k != "demoSha256"})  # the hash is not a Steam ID
    assert not re.search(r"7656119\d{10}", text)
    assert not re.search(r"\d{17}", text)
    ticks = DemoParser(str(MIRAGE)).parse_ticks(["health"], ticks=[20000, 20001])
    names = {str(n) for n in ticks["name"].tolist()}
    assert len(names) >= 10
    strings: list[str] = []

    def walk(node):
        if isinstance(node, dict):
            for k, v in node.items():
                strings.append(str(k))
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
        elif isinstance(node, str):
            strings.append(node)

    walk(mirage)
    lowered = [s.lower() for s in strings]
    for name in names:
        if len(name) < 5:  # short names would collide with ordinary values: require an exact match
            assert name.lower() not in lowered, name
        else:
            assert not any(name.lower() in s for s in lowered), name
    for banned in ("valve counter-strike", "srcds", "steamid", "clan"):
        assert banned not in text.lower()


@needs_mirage
def test_mirage_is_deterministic(mirage, tmp_path):
    again = normalise_demo(MIRAGE, source_id="src_mirage_mm_demoparser_test", demo_sha256=SHA)
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    write_json(a, mirage)
    write_json(b, again)
    assert a.read_bytes() == b.read_bytes()


@needs_mirage
def test_actor_reconstruction_matches_the_demo_when_forced(mirage):
    """Older demos lack event actors; the tick-data reconstruction is validated where truth exists."""
    inferred = normalise_demo(MIRAGE, source_id="src_mirage_mm_demoparser_test", demo_sha256=SHA, _force_infer=True)
    kills = wrong_victim = wrong_attacker = attackers = 0
    for truth_round, guess_round in zip(mirage["rounds"], inferred["rounds"], strict=True):
        truth = [e for e in truth_round["events"] if e["type"] == "kill"]
        guess = [e for e in guess_round["events"] if e["type"] == "kill"]
        assert [e["tick"] for e in truth] == [e["tick"] for e in guess]
        for t, g in zip(truth, guess, strict=True):
            kills += 1
            wrong_victim += t["data"]["victim"] != g["data"]["victim"]
            if g["data"]["attacker"] is not None:
                attackers += 1
                wrong_attacker += t["data"]["attacker"] != g["data"]["attacker"]
    assert kills >= 50
    assert wrong_victim == 0
    assert wrong_attacker == 0  # ambiguous cases must come back as None, never as a wrong pid
    assert attackers >= 0.9 * kills
    bomb_truth = [(e["type"], e["data"]["player"], e["data"]["site"]) for r in mirage["rounds"] for e in r["events"] if e["type"].startswith("bomb")]
    bomb_guess = [(e["type"], e["data"]["player"], e["data"]["site"]) for r in inferred["rounds"] for e in r["events"] if e["type"].startswith("bomb")]
    assert bomb_truth == bomb_guess


def test_parse_source_refuses_demo_that_does_not_match_manifest(isolated_roots):
    manifest = mf.build_manifest(
        source_id="src_bad_hash",
        acquisition={"method": "local_file", "url": None, "retrievedAt": "2026-09-30", "notes": ""},
        demo={"sha256": "a" * 64, "bytes": 3, "localFilename": "src_bad_hash.dem", "mapName": "de_x", "patchVersion": None, "tickrate": 64},
        match={"competition": None, "date": None, "teams": None},
        licence="x", content_lane="synthetic_only", provenance_note="y",
        parser={"name": "demoparser2", "version": "0.42.0", "normaliserVersion": 1},
    )
    mf.write_manifest(manifest)
    demos = paths.demos_dir()
    demos.mkdir(parents=True)
    (demos / "src_bad_hash.dem").write_bytes(b"abc")
    with pytest.raises(NormaliseError, match="sha256"):
        parse_source("src_bad_hash")
