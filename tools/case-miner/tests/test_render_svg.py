from __future__ import annotations

import xml.etree.ElementTree as ET

import pytest

from roundcraft_miner.render import svg
from roundcraft_miner.render.svg import PALETTE, build_map_view, contrast_ratio, fmt, prettify_place, render_candidate, render_to_dir


def player(pid, side, x, y, place, alive=True):
    return {
        "pid": pid, "side": side, "alive": alive, "hp": 100, "armor": 100, "helmet": True, "defuser": False,
        "x": x, "y": y, "z": 0, "place": place, "activeWeapon": None, "primary": None, "secondary": None,
        "utility": {"smoke": 0, "flash": 0, "he": 0, "molotov": 0, "decoy": 0}, "hasC4": False, "money": 0,
        "equipValue": 0, "spottedBy": [],
    }


def make_match():
    rounds = []
    for number in (1, 2):
        frames = []
        for i in range(12):
            players = []
            for n in range(1, 6):
                players.append(player(f"p{n:02d}", "T", -1000 + i * 150 + n * 40, -500 + n * 60, "TSpawn" if i < 3 else "BombsiteA"))
            for n in range(6, 11):
                players.append(player(f"p{n:02d}", "CT", 900 - i * 100 - n * 20, 400 + n * 30, "CTSpawn" if i < 3 else "Palace"))
            frames.append({"tick": i * 32, "t": float(i), "bombPlanted": False, "players": players})
        rounds.append({"number": number, "frames": frames, "events": []})
    return {"map": "de_test", "rounds": rounds}


OWN = [player("p01", "T", -300, -400, "TSpawn"), player("p02", "T", -250, -380, "TSpawn")]
GT_ENEMIES = [
    player("p06", "CT", 500, 600, "Palace"),      # confirmed
    player("p07", "CT", 610, 300, "Palace"),      # last seen elsewhere
    player("p08", "CT", 777, 555, "BombsiteA"),   # unknown
]


def make_candidate():
    return {
        "round": 2, "perspective": "T", "map": "de_test", "decisionTick": 100,
        "playerKnown": {
            "perspective": "T", "tick": 100, "t": 3.0,
            "clock": {"roundSecondsLeft": 72.0, "bombSecondsLeft": None},
            "alive": {"own": 2, "enemy": 3},
            "own": OWN,
            "enemies": [
                {"pid": "p06", "status": "confirmed", "x": 500, "y": 600, "place": "Palace"},
                {"pid": "p07", "status": "last_seen", "x": 200, "y": 100, "place": "Palace", "ageSeconds": 8.2},
                {"pid": "p08", "status": "unknown"},
            ],
            "bomb": {"status": "carried", "knowledge": "confirmed"},
            "utilityObserved": [
                {"kind": "smoke", "side": "CT", "place": "Palace", "x": 100, "y": 0, "ageSeconds": 5.0},
                {"kind": "molotov", "side": "CT", "place": "Palace", "x": -100, "y": 50, "ageSeconds": 2.0},
            ],
            "facts": [],
        },
        "groundTruth": {"enemies": GT_ENEMIES, "bomb": {"status": "carried"}},
    }


def coords(mv, x, y):
    sx, sy = mv.point(x, y)
    return f'cx="{fmt(sx)}" cy="{fmt(sy)}"'


def test_unknown_enemy_only_in_ground_truth():
    match, cand = make_match(), make_candidate()
    out = render_candidate(cand, match)
    mv = build_map_view(match)
    hidden = coords(mv, 777, 555)
    assert hidden in out["groundTruth"]
    assert hidden not in out["playerKnown"]
    # the last-seen enemy's true position is also reviewer only
    truth = coords(mv, 610, 300)
    assert truth in out["groundTruth"] and truth not in out["playerKnown"]
    # confirmed enemy appears in both
    assert coords(mv, 500, 600) in out["playerKnown"]
    assert "Unknown enemies: 1 (not drawn)" in out["playerKnown"]
    assert "reviewer only" in out["groundTruth"].lower()
    assert svg.GROUND_TRUTH_BANNER in out["groundTruth"]
    assert svg.GROUND_TRUTH_BANNER not in out["playerKnown"]


def test_last_seen_dashed_with_age_and_ground_truth_line():
    out = render_candidate(make_candidate(), make_match())
    known = out["playerKnown"]
    assert 'stroke-dasharray="5 4"' in known
    assert "E7 8s" in known
    assert out["groundTruth"].count("<line ") > known.count("<line ")


def test_deterministic():
    a = render_candidate(make_candidate(), make_match())
    b = render_candidate(make_candidate(), make_match())
    assert a == b


def test_well_formed_xml_and_accessible():
    for text in render_candidate(make_candidate(), make_match()).values():
        root = ET.fromstring(text)
        ns = "{http://www.w3.org/2000/svg}"
        assert root.find(f"{ns}title") is not None and root.find(f"{ns}desc") is not None
        assert root.get("role") == "img"


def test_title_line_content():
    known = render_candidate(make_candidate(), make_match())["playerKnown"]
    assert "de_test" in known and "Round 2" in known and "1:12 left" in known and "T perspective" in known
    assert "alive 2 own vs 3 enemy" in known


def test_bomb_marker_only_with_position():
    cand = make_candidate()
    assert "Bomb carried" not in render_candidate(cand, make_match())["playerKnown"]
    cand["playerKnown"]["bomb"] = {"status": "planted", "knowledge": "confirmed", "site": "A", "place": "BombsiteA"}
    assert "Bomb planted" in render_candidate(cand, make_match())["playerKnown"]


def test_footprint_and_projection_are_match_only():
    match = make_match()
    mv = build_map_view(match)
    assert mv.cells
    _, y_north = mv.point(0, 1000)
    _, y_south = mv.point(0, -1000)
    assert y_north < y_south  # north is up
    assert build_map_view(match).footprint_path() == mv.footprint_path()


def test_prettify_place():
    assert prettify_place("BombsiteA") == "A site"
    assert prettify_place("CTSpawn") == "CT spawn"
    assert prettify_place("TSpawn") == "T spawn"
    assert prettify_place("TopMid") == "Top Mid"
    assert prettify_place("ARamp") == "A Ramp"
    assert prettify_place("TopofMid") == "Top of Mid"


def test_text_contrast_meets_aa():
    for fg in ("ink", "ink_soft"):
        assert contrast_ratio(PALETTE[fg], PALETTE["bg"]) >= 4.5
        assert contrast_ratio(PALETTE[fg], PALETTE["cell"]) >= 4.5
    assert contrast_ratio(PALETTE["gt"], PALETTE["bg"]) >= 4.5
    for side in ("CT", "T"):
        assert contrast_ratio(PALETTE["white"], PALETTE[side]) >= 4.5  # numbers inside own markers


def test_render_to_dir(tmp_path):
    written = render_to_dir(make_candidate(), make_match(), tmp_path / "out")
    assert [p.name for p in written] == ["player-known.svg", "ground-truth.svg"]
    for path in written:
        ET.fromstring(path.read_text(encoding="utf-8"))
