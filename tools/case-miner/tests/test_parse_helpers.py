"""Unit tests for pure normalisation helpers. No demo file needed."""

from __future__ import annotations

import pandas as pd

from roundcraft_miner.parse.helpers import (
    count_utility,
    has_c4,
    nearest_place,
    primary_weapon,
    round_end_reason,
    round_t,
    secondary_weapon,
    side_from_team_num,
    site_from_place,
    snap_tickrate,
    weapon_matches_event,
)
from roundcraft_miner.parse.normalise import find_rounds
from roundcraft_miner.parse.tickstore import build_tick_store


def test_round_end_reason_mapping():
    assert round_end_reason(1) == "target_bombed"
    assert round_end_reason(7) == "bomb_defused"
    assert round_end_reason(8) == "ct_win_elimination"
    assert round_end_reason(9) == "t_win_elimination"
    assert round_end_reason(12) == "time_ran_out"
    assert round_end_reason(17) == "t_surrender"
    assert round_end_reason(18) == "ct_surrender"
    assert round_end_reason(99) == "reason_99"
    assert round_end_reason(None) == "reason_unknown"


def test_side_from_team_num():
    assert side_from_team_num(2) == "T"
    assert side_from_team_num(3) == "CT"
    assert side_from_team_num(0) is None
    assert side_from_team_num(1) is None
    assert side_from_team_num(None) is None


def test_count_utility_merges_molotov_and_incendiary():
    inventory = [
        "knife_t", "Glock-18", "AK-47", "Flashbang", "Flashbang", "Smoke Grenade",
        "Molotov", "Incendiary Grenade", "High Explosive Grenade", "Decoy Grenade", "C4 Explosive",
    ]
    assert count_utility(inventory) == {"smoke": 1, "flash": 2, "he": 1, "molotov": 2, "decoy": 1}
    assert count_utility([]) == {"smoke": 0, "flash": 0, "he": 0, "molotov": 0, "decoy": 0}
    assert count_utility(None) == {"smoke": 0, "flash": 0, "he": 0, "molotov": 0, "decoy": 0}


def test_primary_secondary_and_c4():
    inventory = ["Bowie Knife", "USP-S", "M4A4", "C4 Explosive"]
    assert primary_weapon(inventory) == "M4A4"
    assert secondary_weapon(inventory) == "USP-S"
    assert has_c4(inventory) is True
    assert primary_weapon(["knife_t", "Glock-18"]) is None
    assert secondary_weapon(["knife_t", "AWP"]) is None
    assert has_c4(["knife_t", "Glock-18"]) is False
    assert primary_weapon(["Glock-18", "MAC-10", "AK-47"]) == "MAC-10"  # first in inventory order
    assert primary_weapon(["Negev"]) == "Negev"
    assert primary_weapon(["Sawed-Off"]) == "Sawed-Off"


def test_weapon_matches_event():
    assert weapon_matches_event("AK-47", "ak47")
    assert weapon_matches_event("M4A4", "m4a1")
    assert weapon_matches_event("M4A1-S", "m4a1_silencer")
    assert weapon_matches_event("P2000", "hkp2000")
    assert not weapon_matches_event("AK-47", "m4a1")
    assert not weapon_matches_event("Flashbang", "hegrenade")  # grenades are never matchable
    assert not weapon_matches_event(None, "ak47")


def test_site_from_place():
    assert site_from_place("BombsiteA") == "A"
    assert site_from_place("BombsiteB") == "B"
    assert site_from_place("Middle") is None
    assert site_from_place(None) is None


def test_snap_tickrate_and_round_t():
    assert snap_tickrate(63.7) == 64
    assert snap_tickrate(127.2) == 128
    assert round_t(1.23456) == 1.23
    assert str(round_t(-0.0)) == "0.0"


def test_nearest_place_ties_and_missing_places():
    points = [(0.0, 0.0, 0.0, "A"), (10.0, 0.0, 0.0, "B"), (5.0, 0.0, 0.0, None)]
    assert nearest_place(points, 6.0, 0.0, 0.0) == "B"  # the None-place point is ignored
    assert nearest_place(points, 5.0, 0.0, 0.0) == "A"  # exact tie resolves to the earliest point
    assert nearest_place([], 0.0, 0.0, 0.0) is None


def test_find_rounds_skips_warmup_and_freeze_time_endings():
    freeze_ends = [100, 1000, 2000, 3000]  # 100 is warmup
    round_ends = [
        {"tick": 500, "winner": 2, "reason": 9, "is_warmup_period": True},
        {"tick": 1500, "winner": 3, "reason": 8, "is_warmup_period": False},
        {"tick": 2500, "winner": 2, "reason": 1, "is_warmup_period": False},
        {"tick": 3100, "winner": 2, "reason": 9, "is_warmup_period": False},
        {"tick": 3300, "winner": 2, "reason": 18, "is_warmup_period": False},  # no freeze_end: surrender
    ]
    rounds, warnings = find_rounds(match_start=200, freeze_ends=freeze_ends, round_ends=round_ends)
    assert [(r["freeze_end"], r["tick"]) for r in rounds] == [(1000, 1500), (2000, 2500), (3000, 3100)]
    assert len(warnings) == 1 and "3300" in warnings[0]


def _row(steamid, tick, team, alive=True, spotted=(), name="Someone"):
    return {
        "X": 1.4, "Y": -2.6, "Z": 3.0, "health": 100 if alive else 0, "armor_value": 50, "team_num": team,
        "is_alive": alive, "last_place_name": "BombsiteA", "balance": 800, "current_equip_value": 2700,
        "inventory": ["knife_t", "Glock-18", "AK-47", "Smoke Grenade", "C4 Explosive"],
        "has_defuser": False, "has_helmet": True, "active_weapon_name": "AK-47",
        "CCSPlayerPawn.m_bSpottedByMask": list(spotted),
        "is_bomb_planted": False, "is_warmup_period": False,
        "CCSGameRulesProxy.CCSGameRules.m_iRoundTime": 115, "tick": tick, "steamid": steamid, "name": name,
    }


def test_build_tick_store_anonymises_and_filters_spotters():
    t1, t2, ct1 = 76561198000000300, 76561198000000100, 76561198000000200
    df = pd.DataFrame(
        [
            _row(t1, 100, 2, spotted=[ct1, t2]),  # a teammate in the mask must be dropped
            _row(t2, 100, 2),
            _row(ct1, 100, 3, spotted=[t1]),
            _row(0, 100, 3),  # bot / unassigned steam id is ignored
            _row(76561198000000400, 100, 1),  # spectator row is treated as missing
        ]
    )
    store = build_tick_store(df)
    assert store.roster == ["p01", "p02", "p03"]  # numeric Steam ID order: 100 < 200 < 300
    assert store.steam_to_pid[str(t2)] == "p01"
    state = store.states[100]["p03"]  # t1 has the highest steam id
    assert state["spottedBy"] == ["p02"]  # only the enemy CT
    assert state["x"] == 1 and state["y"] == -3 and state["z"] == 3
    assert state["primary"] == "AK-47" and state["secondary"] == "Glock-18" and state["hasC4"] is True
    assert state["utility"]["smoke"] == 1
    assert store.states[100]["p02"]["spottedBy"] == ["p03"]
    assert "name" not in state and "steamid" not in state


def test_tickstore_lookups():
    df = pd.DataFrame([_row(76561198000000100, t, 2) for t in (10, 13, 16)])
    store = build_tick_store(df)
    assert store.prev(13) == 10
    assert store.next_ge(14) == 16
    assert store.nearest(14) == 13
    assert store.nearest(11) == 10
    assert store.first_available([11, 12, 13]) == 13
    assert store.prev(10) is None
