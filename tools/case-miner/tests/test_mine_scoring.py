"""Scoring bounds and factor behaviour."""

from __future__ import annotations

import mine_synth as s
from roundcraft_miner.mine import scoring
from roundcraft_miner.mine.detectors import detect_decisions
from roundcraft_miner.mine.followup import find_followup
from roundcraft_miner.mine.knowledge import knowledge_view
from roundcraft_miner.mine.scoring import score_candidate


def test_weights_sum_to_one_and_cover_every_factor():
    assert abs(sum(scoring.WEIGHTS.values()) - 1.0) < 1e-9
    assert set(scoring.WEIGHTS) == {"ambiguity", "stakes", "incompleteness", "time_pressure", "presentable", "followup_quality", "not_aim_duel", "transferable"}


def test_every_detected_candidate_scores_within_bounds():
    match = s.post_plant_match()
    round_ = match["rounds"][0]
    decisions = detect_decisions(match)
    assert decisions
    for decision in decisions:
        view = knowledge_view(match, round_, decision["tick"], decision["perspective"])
        follow = find_followup(match, round_, decision["tick"], decision["perspective"])
        score = score_candidate(match, round_, decision["category"], view, follow)
        assert 0.0 <= score["total"] <= 1.0
        assert set(score["factors"]) == set(scoring.WEIGHTS)
        assert all(0.0 <= value <= 1.0 for value in score["factors"].values())
        assert score == score_candidate(match, round_, decision["category"], view, follow)


def _view(match, round_, t, persp="CT"):
    return knowledge_view(match, round_, s.tick_of(t), persp)


def test_incompleteness_is_a_tent_function():
    round_ = s.make_round(1, duration=60.0, spotted=[(pid, ["p08"], 20.0, 20.0) for pid in s.T_PIDS])
    match = s.make_match([round_])
    assert scoring.incompleteness(_view(match, round_, 20.0)) == 0.0  # everything confirmed
    assert scoring.incompleteness(_view(match, round_, 10.0)) == 0.0  # nothing known at all
    partial = s.make_round(1, duration=60.0, spotted=[(pid, ["p08"], 20.0, 20.0) for pid in s.T_PIDS[:2]])
    assert scoring.incompleteness(_view(s.make_match([partial]), partial, 20.0)) == 1.0  # 3 of 5 unknown = 0.6
    stale = scoring.incompleteness(_view(s.make_match([partial]), partial, 30.0))  # all last_seen/unknown, none confirmed
    assert 0.0 < stale < 1.0


def test_time_pressure_prefers_ten_to_forty_seconds():
    round_ = s.make_round(1, duration=112.0)
    match = s.make_match([round_])
    high = scoring.time_pressure(_view(match, round_, 85.0))  # 30 s left
    low = scoring.time_pressure(_view(match, round_, 10.0))  # 105 s left
    assert high == 1.0 and low < 0.3


def test_aim_duel_penalty_for_one_alive_and_for_kills_right_after():
    events = [s.kill(20.0 + i, "p01", pid) for i, pid in enumerate(s.CT_PIDS[:4])]
    round_ = s.make_round(1, duration=60.0, events=events)
    match = s.make_match([round_])
    assert scoring.not_aim_duel(match, round_, _view(match, round_, 30.0)) == 0.1  # CT down to one
    calm = s.make_round(1, duration=60.0)
    assert scoring.not_aim_duel(s.make_match([calm]), calm, _view(s.make_match([calm]), calm, 30.0)) == 1.0
    soon = s.make_round(1, duration=60.0, events=[s.kill(31.0, "p01", "p07")])
    assert scoring.not_aim_duel(s.make_match([soon]), soon, _view(s.make_match([soon]), soon, 30.0)) == 0.4


def test_followup_quality_zero_without_a_followup_and_high_for_a_fresh_sighting():
    round_ = s.make_round(1, duration=90.0, spotted=[("p03", ["p08"], 52.0, 53.0)])
    match = s.make_match([round_])
    view = _view(match, round_, 45.0)
    assert scoring.followup_quality(match, view, None) == 0.0
    follow = find_followup(match, round_, s.tick_of(45.0), "CT")
    assert scoring.followup_quality(match, view, follow) > 0.8


def test_presentable_gate_and_chaos():
    events = [s.kill(28.0, "p01", "p07"), s.kill(29.0, "p02", "p08"), s.kill(29.5, "p03", "p09")]
    round_ = s.make_round(1, duration=60.0, events=events)
    match = s.make_match([round_])
    chaotic = scoring.presentable(match, round_, _view(match, round_, 30.0))
    calm = s.make_round(1, duration=60.0)
    assert chaotic < scoring.presentable(s.make_match([calm]), calm, _view(s.make_match([calm]), calm, 30.0))
    lone = s.make_round(1, duration=60.0, events=[s.kill(20.0 + i, "p01", pid) for i, pid in enumerate(s.CT_PIDS[:4])])
    assert scoring.presentable(s.make_match([lone]), lone, _view(s.make_match([lone]), lone, 30.0)) == 0.0
