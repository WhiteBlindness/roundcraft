"""The player-knowledge layer must never let ground truth into the view."""

from __future__ import annotations

import json

import mine_synth as s
from roundcraft_miner.mine import knowledge as k
from roundcraft_miner.mine.knowledge import knowledge_view

SECRET = (7777, 8888, "Zzyzx")  # a place/coordinate that appears nowhere else in the fixture


def _round(**kwargs):
    return s.make_round(1, duration=90.0, **kwargs)


def _match(round_):
    return s.make_match([round_])


def _enemy(view, pid):
    return next(e for e in view["enemies"] if e["pid"] == pid)


def test_never_spotted_enemy_has_no_coordinates_or_place_anywhere_in_the_view():
    # p03 (T) stands on SECRET the whole round, and nobody ever spots him.
    round_ = _round(positions={"p03": SECRET})
    match = _match(round_)
    view = knowledge_view(match, round_, s.tick_of(30), "CT")
    entry = _enemy(view, "p03")
    assert entry == {"pid": "p03", "status": "unknown"}
    blob = json.dumps(view)
    assert "Zzyzx" not in blob and "7777" not in blob and "8888" not in blob


def test_enemy_spotted_only_after_the_decision_tick_is_unknown_at_the_decision():
    round_ = _round(positions={"p03": SECRET}, spotted=[("p03", ["p08"], 40.0, 42.0)])
    match = _match(round_)
    before = knowledge_view(match, round_, s.tick_of(39.5), "CT")
    assert _enemy(before, "p03") == {"pid": "p03", "status": "unknown"}
    assert "Zzyzx" not in json.dumps(before)
    after = knowledge_view(match, round_, s.tick_of(40.5), "CT")
    assert _enemy(after, "p03")["status"] == "confirmed"
    assert _enemy(after, "p03")["place"] == "Zzyzx"


def test_a_sighting_by_a_dead_observer_does_not_count():
    # p08 (CT) is killed at t=20; the frames from t=21 still list p08 as a spotter of p03.
    events = [s.kill(20.0, "p01", "p08")]
    round_ = _round(positions={"p03": SECRET}, events=events, spotted=[("p03", ["p08"], 21.0, 30.0)])
    match = _match(round_)
    view = knowledge_view(match, round_, s.tick_of(25), "CT")
    assert _enemy(view, "p03") == {"pid": "p03", "status": "unknown"}
    assert "Zzyzx" not in json.dumps(view)


def test_a_sighting_by_a_living_teammate_counts_even_if_the_observer_dies_later():
    events = [s.kill(24.0, "p01", "p08")]
    round_ = _round(positions={"p03": SECRET}, events=events, spotted=[("p03", ["p08"], 20.0, 23.5)])
    match = _match(round_)
    view = knowledge_view(match, round_, s.tick_of(26), "CT")
    seen = _enemy(view, "p03")
    assert seen["status"] == "last_seen"  # 2.5 s old: beyond the 2.0 s confirm window
    assert seen["place"] == "Zzyzx"
    assert seen["ageSeconds"] == 2.5


def test_ct_does_not_learn_the_bomb_carrier_unless_the_carrier_is_spotted():
    round_ = _round(carrier="p01", spotted=[("p02", ["p08"], 30.0, 31.0)])  # someone else is seen, not the carrier
    match = _match(round_)
    view = knowledge_view(match, round_, s.tick_of(31), "CT")
    assert view["bomb"] == {"status": "unknown", "knowledge": "unknown"}
    assert not any("bomb carrier" in f["text"] and f["status"] != "unknown" for f in view["facts"])
    assert "A site" not in json.dumps(view["bomb"])


def test_ct_learns_the_bomb_carrier_when_seen_and_the_knowledge_ages():
    round_ = _round(carrier="p01", spotted=[("p01", ["p08"], 30.0, 31.0)])
    match = _match(round_)
    now = knowledge_view(match, round_, s.tick_of(31), "CT")
    assert now["bomb"]["status"] == "carried" and now["bomb"]["knowledge"] == "confirmed"
    assert now["bomb"]["place"] == "BombsiteA"
    later = knowledge_view(match, round_, s.tick_of(41), "CT")
    assert later["bomb"]["knowledge"] == "last_seen"
    assert later["bomb"]["ageSeconds"] == 10.0
    stale = knowledge_view(match, round_, s.tick_of(80), "CT")
    assert stale["bomb"] == {"status": "unknown", "knowledge": "unknown"}


def test_t_always_knows_the_bomb_and_ct_knows_a_plant():
    events = [s.plant_event(45.0)]
    round_ = _round(events=events)
    match = _match(round_)
    t_view = knowledge_view(match, round_, s.tick_of(20), "T")
    assert t_view["bomb"]["status"] == "carried" and t_view["bomb"]["knowledge"] == "confirmed"
    ct_after = knowledge_view(match, round_, s.tick_of(46), "CT")
    assert ct_after["bomb"]["status"] == "planted" and ct_after["bomb"]["site"] == "A"
    assert ct_after["clock"]["roundSecondsLeft"] is None
    assert ct_after["clock"]["bombSecondsLeft"] == 39.0
    ct_before = knowledge_view(match, round_, s.tick_of(44), "CT")
    assert ct_before["bomb"]["status"] == "unknown"  # the plant has not happened yet
    assert ct_before["clock"]["bombSecondsLeft"] is None
    assert ct_before["clock"]["roundSecondsLeft"] == 71.0


def test_enemy_utility_far_from_every_living_own_player_is_excluded():
    far = (9000, 9000, "Zzyzx")
    near = (1100, 1000, "BombsiteA")  # next to CT p08 standing on A
    events = [
        s.utility_event(20.0, "smoke", "p01", far),
        s.utility_event(21.0, "molotov", "p02", near),
        s.utility_event(22.0, "flash", "p03", near),  # enemy flashes are never reported
        s.utility_event(22.5, "he", "p04", near),
        s.utility_event(23.0, "smoke", "p05", near),
        s.utility_event(23.5, "smoke", "p06", far),  # own utility is always known
    ]
    round_ = _round(events=events)
    match = _match(round_)
    view = knowledge_view(match, round_, s.tick_of(25), "CT")
    kinds = sorted((u["kind"], u["side"], u["place"]) for u in view["utilityObserved"])
    assert kinds == [("molotov", "T", "BombsiteA"), ("smoke", "CT", "Zzyzx"), ("smoke", "T", "BombsiteA")]
    assert "9000" not in json.dumps([f for f in view["facts"]])


def test_enemy_utility_is_ignored_when_the_only_nearby_observer_is_dead():
    near = (1100, 1000, "BombsiteA")
    # p08 (the only CT on A) dies at t=10; a smoke goes off next to A at t=20.
    events = [s.kill(10.0, "p01", "p08"), s.utility_event(20.0, "smoke", "p02", near)]
    round_ = _round(events=events)
    match = _match(round_)
    view = knowledge_view(match, round_, s.tick_of(22), "CT")
    assert view["utilityObserved"] == []


def test_utility_outside_the_20_second_window_or_expired_is_excluded():
    near = (1100, 1000, "BombsiteA")
    events = [
        s.utility_event(10.0, "molotov", "p01", near),  # 20.5 s old at t=30.5
        s.utility_event(28.0, "smoke", "p02", near, expiresTick=s.tick_of(29.0)),  # expired
        s.utility_event(29.0, "smoke", "p03", near, expiresTick=s.tick_of(45.0)),
    ]
    round_ = _round(events=events)
    match = _match(round_)
    view = knowledge_view(match, round_, s.tick_of(30.5), "CT")
    assert [(u["kind"], u["ageSeconds"]) for u in view["utilityObserved"]] == [("smoke", 1.5)]


def test_age_seconds_and_status_thresholds():
    round_ = _round(positions={"p03": SECRET}, spotted=[("p03", ["p08"], 10.0, 10.0)])
    match = _match(round_)
    cases = {11.0: ("confirmed", 1.0), 12.0: ("confirmed", 2.0), 12.5: ("last_seen", 2.5), 18.0: ("last_seen", 8.0), 55.0: ("last_seen", 45.0), 56.0: ("unknown", None)}
    for t, (status, age) in cases.items():
        entry = _enemy(knowledge_view(match, round_, s.tick_of(t), "CT"), "p03")
        assert entry["status"] == status, t
        if age is None:
            assert set(entry) == {"pid", "status"}
        else:
            assert entry["ageSeconds"] == age
            assert (entry["x"], entry["y"], entry["place"]) == SECRET


def test_position_and_weapon_are_those_of_the_latest_sighting_not_the_current_position():
    def moving(t):
        return (100 + int(t * 10), 0, "Jungle") if t < 20 else (5000, 5000, "Zzyzx")

    round_ = _round(positions={"p03": moving}, spotted=[("p03", ["p08"], 15.0, 17.0)], weapons={"p03": "AWP"})
    match = _match(round_)
    entry = _enemy(knowledge_view(match, round_, s.tick_of(30), "CT"), "p03")
    assert entry["place"] == "Jungle" and entry["x"] == 100 + 170 and entry["ageSeconds"] == 13.0
    assert entry["weaponSeen"] == "AWP"
    assert "Zzyzx" not in json.dumps(knowledge_view(match, round_, s.tick_of(30), "CT"))


def test_future_kills_do_not_change_the_view_at_an_earlier_tick():
    events = [s.kill(40.0, "p01", "p07")]
    round_ = _round(events=events)
    match = _match(round_)
    early = knowledge_view(match, round_, s.tick_of(39.5), "CT")
    late = knowledge_view(match, round_, s.tick_of(40.5), "CT")
    assert early["alive"] == {"own": 5, "enemy": 5}
    assert late["alive"] == {"own": 4, "enemy": 5}
    assert all(p["pid"] != "p07" for p in late["own"])


def test_kill_between_frames_is_applied_at_a_non_frame_tick():
    events = [s.kill(40.2, "p01", "p07")]
    round_ = _round(events=events)
    match = _match(round_)
    view = knowledge_view(match, round_, s.tick_of(40.3), "CT")  # latest frame is t=40.0
    assert view["alive"]["own"] == 4


def test_dead_enemies_are_excluded_from_the_enemy_list():
    events = [s.kill(20.0, "p06", "p02")]
    round_ = _round(events=events)
    match = _match(round_)
    view = knowledge_view(match, round_, s.tick_of(25), "CT")
    assert [e["pid"] for e in view["enemies"]] == ["p01", "p03", "p04", "p05"]
    assert view["alive"]["enemy"] == 4


def test_own_players_do_not_expose_which_enemies_can_see_them():
    round_ = _round(spotted=[("p08", ["p01", "p02"], 20.0, 30.0)])  # T see CT p08
    match = _match(round_)
    view = knowledge_view(match, round_, s.tick_of(25), "CT")
    assert all(p["spottedBy"] == [] for p in view["own"])


def test_facts_have_no_player_ids_and_respect_the_length_limits():
    round_ = _round(positions={"p03": SECRET}, spotted=[("p03", ["p08"], 10.0, 24.0), ("p04", ["p09"], 24.0, 25.0)], weapons={"p04": "AWP"})
    match = _match(round_)
    for perspective in ("CT", "T"):
        view = knowledge_view(match, round_, s.tick_of(25), perspective)
        assert view["facts"], perspective
        for fact in view["facts"]:
            assert 8 <= len(fact["text"]) <= 200
            assert fact["status"] in {"confirmed", "last_seen", "inferred", "unknown"}
            assert fact["basis"]
            for pid in s.T_PIDS + s.CT_PIDS:
                assert pid not in fact["text"] and pid not in fact["basis"]
        assert len({f["id"] for f in view["facts"]}) == len(view["facts"])


def test_example_fact_wording():
    round_ = _round(positions={"p03": (300, 1100, "Jungle")}, spotted=[("p03", ["p08"], 24.0, 25.0), ("p04", ["p09"], 16.0, 17.0)], weapons={"p04": "AWP"})
    match = _match(round_)
    view = knowledge_view(match, round_, s.tick_of(25), "CT")
    texts = [f["text"] for f in view["facts"]]
    assert "5 CTs alive against 5 Ts." in texts
    assert "One attacker is visible in Jungle right now with an AK-47." in texts
    assert "One attacker was last seen in Connector 8 s ago with an AWP." in texts
    assert "The positions of three attackers are unknown." in texts
    assert any(t.startswith("Your team has 5 smokes, 10 flashes and 5 molotovs left") for t in texts)


def test_view_is_deterministic():
    round_ = _round(spotted=[("p03", ["p08"], 10.0, 24.0)])
    match = _match(round_)
    a = json.dumps(knowledge_view(match, round_, s.tick_of(25), "CT"), sort_keys=True)
    b = json.dumps(knowledge_view(match, round_, s.tick_of(25), "CT"), sort_keys=True)
    assert a == b


def test_inferred_economy_fact_uses_only_public_round_history():
    # Rounds 1-3: CT win each time (T lose). In round 4 the Ts have lost 3 in a row.
    rounds = [s.make_round(n, duration=60.0, winner="CT", end_reason="ct_win_elimination") for n in (1, 2, 3, 4)]
    match = s.make_match(rounds)
    view = knowledge_view(match, rounds[3], s.tick_of(30), "CT")
    econ = [f for f in view["facts"] if f["status"] == "inferred"]
    assert len(econ) == 1
    assert "lost 3 rounds in a row" in econ[0]["text"] and "reduced buy" in econ[0]["text"]
    assert "public scoreboard" in econ[0]["basis"]
    # From the T side the enemy (CT) has just been winning: no inference.
    t_view = knowledge_view(match, rounds[3], s.tick_of(30), "T")
    assert not [f for f in t_view["facts"] if f["status"] == "inferred"]
    # Round 2 only has one lost round behind it: below the threshold.
    assert not [f for f in knowledge_view(match, rounds[1], s.tick_of(30), "CT")["facts"] if f["status"] == "inferred"]


def test_a_side_swap_ends_the_loss_streak():
    rounds = [
        s.make_round(1, duration=60.0, winner="CT"),
        s.make_round(2, duration=60.0, winner="CT"),
        s.make_round(3, duration=60.0, winner="T", flip_sides=True),  # sides swapped (half time)
    ]
    match = s.make_match(rounds)
    streak, _ = k.enemy_loss_streak(match, rounds[2], "CT")
    assert streak == 0
