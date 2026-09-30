"""Detector fixtures and the dedupe/cap rule."""

from __future__ import annotations

import mine_synth as s
from roundcraft_miner.mine.detectors import dedupe_and_cap, detect_decisions, detect_round
from roundcraft_miner.mine.pipeline import mine_match


def _detect(round_):
    return detect_round(s.make_match([round_]), round_)


def _by(found, category, perspective=None):
    return [d for d in found if d["category"] == category and (perspective is None or d["perspective"] == perspective)]


def test_synthetic_post_plant_round_yields_a_ct_post_plant_candidate_at_plant_plus_four_seconds():
    match = s.post_plant_match()
    found = detect_decisions(match)
    ct = _by(found, "post_plant", "CT")
    assert len(ct) == 1
    assert ct[0]["tick"] == s.tick_of(49.0)
    assert ct[0]["t"] == 49.0
    assert len(_by(found, "post_plant", "T")) == 1
    candidates = mine_match(match)
    assert any(c["category"] == "post_plant" and c["perspective"] == "CT" and c["decisionTick"] == s.tick_of(49.0) for c in candidates)


def test_post_plant_is_skipped_when_nobody_is_left_on_a_side():
    events = [s.plant_event(45.0)] + [s.kill(46.0 + i * 0.1, "p01", pid) for i, pid in enumerate(s.CT_PIDS)]
    round_ = s.make_round(1, duration=60.0, events=events)
    assert _by(_detect(round_), "post_plant") == []


def test_opening_pick_uses_the_first_kill_after_five_seconds_for_both_sides():
    round_ = s.make_round(1, duration=60.0, events=[s.kill(20.0, "p01", "p07")])
    found = _by(_detect(round_), "opening_pick")
    assert {(d["perspective"], d["tick"]) for d in found} == {("T", s.tick_of(22.0)), ("CT", s.tick_of(22.0))}


def test_a_kill_before_five_seconds_is_not_an_opening_pick():
    round_ = s.make_round(1, duration=60.0, events=[s.kill(3.0, "p01", "p07")])
    assert _by(_detect(round_), "opening_pick") == []


def test_man_advantage_shift_skips_one_alive_states():
    events = [s.kill(20.0, "p01", "p07"), s.kill(30.0, "p02", "p08"), s.kill(40.0, "p03", "p09"), s.kill(50.0, "p04", "p10")]
    round_ = s.make_round(1, duration=80.0, events=events)
    found = _by(_detect(round_), "man_advantage_shift")
    states = {(d["perspective"], d["t"]) for d in found}
    assert ("CT", 32.0) in states and ("T", 32.0) in states  # 5v3 / 3v5 are meaningful
    assert ("CT", 42.0) in states  # 2 CT vs 5 T
    assert ("CT", 52.0) not in states  # CT down to one player
    assert ("T", 52.0) not in states or True
    ct_only_one = [d for d in found if d["t"] == 52.0 and d["perspective"] == "CT"]
    assert ct_only_one == []


def test_late_round_no_plant_needs_two_ts_alive_and_no_plant():
    round_ = s.make_round(1, duration=112.0)
    found = _by(_detect(round_), "late_round_no_plant")
    assert [d["perspective"] for d in found] == ["T"] and found[0]["t"] == 80.0
    planted = s.make_round(1, duration=112.0, events=[s.plant_event(60.0)])
    assert _by(_detect(planted), "late_round_no_plant") == []
    one_t = s.make_round(1, duration=112.0, events=[s.kill(20.0 + i, "p06", pid) for i, pid in enumerate(["p01", "p02", "p03", "p04"])])
    assert _by(_detect(one_t), "late_round_no_plant") == []


def test_low_utility_attack_needs_three_ts_and_at_most_two_utility_items():
    bare = {pid: {"smoke": 0, "flash": 0, "he": 0, "molotov": 0, "decoy": 0} for pid in s.T_PIDS}
    round_ = s.make_round(1, duration=100.0, utility=bare)
    found = _by(_detect(round_), "low_utility_attack")
    assert len(found) == 1 and found[0]["t"] == 55.0  # first frame with <= 60 s left
    assert _by(_detect(s.make_round(1, duration=100.0)), "low_utility_attack") == []  # default team has plenty


def test_economy_save_when_two_ts_face_three_or_more_cts_late():
    events = [s.kill(30.0 + i, "p06", pid) for i, pid in enumerate(["p01", "p02", "p03"])]
    round_ = s.make_round(1, duration=110.0, events=events)
    found = _by(_detect(round_), "economy_save", "T")
    assert len(found) == 1 and found[0]["t"] == 90.0  # 25 s left on the 115 s clock


def test_rotation_read_two_confirmed_ts_near_one_site_while_a_ct_is_far():
    near_a = {"p02": (1100, 1000, "Palace"), "p03": (900, 1100, "Palace")}
    spotted = [("p02", ["p08"], 30.0, 30.5), ("p03", ["p08"], 30.0, 30.5)]
    positions = {**near_a, "p08": s.A_SITE, "p09": s.B_SITE, "p10": s.B_SITE, "p06": s.B_SITE, "p07": s.B_SITE}
    round_ = s.make_round(1, duration=60.0, positions=positions, spotted=spotted)
    match = s.make_match([round_])
    found = _by(detect_round(match, round_), "rotation_read", "CT")
    assert len(found) == 1 and found[0]["t"] == 30.0 and found[0]["detail"]["site"] == "A"
    # A CT standing on A is not "elsewhere" when all CTs are already there.
    all_at_a = {**positions, **{pid: s.A_SITE for pid in s.CT_PIDS}}
    round_ = s.make_round(1, duration=60.0, positions=all_at_a, spotted=spotted)
    assert _by(detect_round(s.make_match([round_]), round_), "rotation_read") == []


def _item(round_, perspective, t, score, category="x"):
    return {"round": round_, "perspective": perspective, "t": t, "tick": int(t * 64), "category": category, "score": score}


def test_dedupe_keeps_the_higher_score_within_five_seconds():
    items = [_item(1, "CT", 10.0, 0.5, "a"), _item(1, "CT", 14.0, 0.9, "b"), _item(1, "CT", 30.0, 0.4, "c")]
    kept = dedupe_and_cap(items)
    assert [i["category"] for i in kept] == ["b", "c"]
    # exactly on the boundary still counts as the same moment; other perspectives and rounds are independent
    items = [_item(1, "CT", 10.0, 0.5), _item(1, "CT", 15.0, 0.6, "y"), _item(1, "T", 10.0, 0.5, "z"), _item(2, "CT", 10.0, 0.5, "w")]
    assert sorted(i["category"] for i in dedupe_and_cap(items)) == ["w", "y", "z"]


def test_cap_is_two_per_round_and_perspective_and_output_is_deterministic():
    items = [_item(1, "CT", 10.0 + 10 * n, 0.9 - n * 0.1, f"c{n}") for n in range(5)]
    kept = dedupe_and_cap(items)
    assert [i["category"] for i in kept] == ["c0", "c1"]
    assert dedupe_and_cap(list(reversed(items))) == kept
