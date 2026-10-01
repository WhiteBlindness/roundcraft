"""Follow-up selection and the no-future-information guarantee."""

from __future__ import annotations

import copy
import json

import mine_synth as s
from roundcraft_miner.mine.followup import find_followup
from roundcraft_miner.mine.knowledge import knowledge_view

SECRET = (7777, 8888, "Zzyzx")
JUNGLE = (300, 1100, "Jungle")


def _setup(events=None, spotted=None, positions=None, duration=90.0):
    round_ = s.make_round(1, duration=duration, events=events, spotted=spotted, positions=positions)
    return s.make_match([round_]), round_


def test_followup_is_the_first_newly_confirmed_enemy_after_three_seconds():
    match, round_ = _setup(spotted=[("p03", ["p08"], 52.0, 53.0)], positions={"p03": JUNGLE})
    decision = s.tick_of(45)
    follow = find_followup(match, round_, decision, "CT")
    assert follow is not None
    assert follow["kind"] == "enemy_spotted"
    assert follow["tick"] == s.tick_of(52.0)
    assert follow["summary"] == "An attacker appears in Jungle."
    assert any("visible in Jungle" in fact["text"] for fact in follow["newFacts"])
    assert follow["knowledgeAfter"]["tick"] == follow["tick"]
    assert [e for e in follow["knowledgeAfter"]["enemies"] if e["pid"] == "p03"][0]["place"] == "Jungle"


def test_followup_excludes_events_before_the_decision_and_inside_the_first_three_seconds():
    # Sighting before the decision, a kill 1 s after it and another sighting 2 s after it: none may be the follow-up.
    events = [s.kill(46.0, "p01", "p07")]
    spotted = [("p03", ["p08"], 40.0, 41.0), ("p04", ["p09"], 47.0, 47.0)]
    match, round_ = _setup(events=events, spotted=spotted, positions={"p03": JUNGLE})
    assert find_followup(match, round_, s.tick_of(45), "CT") is None


def test_followup_ignores_events_after_twenty_five_seconds():
    match, round_ = _setup(spotted=[("p03", ["p08"], 71.0, 72.0)], positions={"p03": JUNGLE})
    assert find_followup(match, round_, s.tick_of(45), "CT") is None
    match, round_ = _setup(spotted=[("p03", ["p08"], 69.5, 70.0)], positions={"p03": JUNGLE})
    assert find_followup(match, round_, s.tick_of(45), "CT") is not None


def test_an_enemy_already_confirmed_at_the_decision_and_staying_put_is_not_news():
    match, round_ = _setup(spotted=[("p03", ["p08"], 44.0, 60.0)], positions={"p03": JUNGLE})
    assert find_followup(match, round_, s.tick_of(45), "CT") is None


def test_followup_kill_wording_is_player_known_and_has_no_pids():
    events = [s.kill(55.0, "p06", "p03")]
    match, round_ = _setup(events=events)
    # A CT killing an attacker is CT's own action; for T it is news worded without identities.
    assert find_followup(match, round_, s.tick_of(45), "CT") is None
    follow = find_followup(match, round_, s.tick_of(45), "T")
    assert follow["kind"] == "kill"
    assert follow["summary"] == "One of your players is killed; 4 of your team left."
    assert not any(pid in follow["summary"] for pid in s.T_PIDS + s.CT_PIDS)
    own_death = [s.kill(55.0, "p03", "p07")]
    match, round_ = _setup(events=own_death)
    # For T this kill is the team's own action (the historical line), so it is never a follow-up premise.
    assert find_followup(match, round_, s.tick_of(45), "T") is None
    follow = find_followup(match, round_, s.tick_of(45), "CT")
    assert follow["summary"] == "One of your players is killed; 4 of your team left."


def test_bomb_plant_is_followup_for_ct_and_own_action_is_still_reported_for_t():
    match, round_ = _setup(events=[s.plant_event(50.0)])
    ct = find_followup(match, round_, s.tick_of(45), "CT")
    assert ct["kind"] == "bomb_planted" and ct["summary"] == "The bomb is planted at A."
    assert ct["knowledgeAfter"]["bomb"]["status"] == "planted"
    assert ct["knowledgeAfter"]["bomb"]["site"] == "A"


def test_defuse_start_is_only_known_to_t_when_a_t_is_within_earshot():
    defuse = s.event(55.0, "bomb_defuse_begin", player="p08", site="A", place="BombsiteA", x=1000, y=1000)
    # p01 (T) stands on the site, so the T side hears it.
    match, round_ = _setup(events=[s.plant_event(40.0), defuse])
    assert find_followup(match, round_, s.tick_of(46), "T")["kind"] == "defuse_started"
    # Everyone on T is far from the bomb: no follow-up for T, but CT knows its own defuse.
    far = {pid: s.T_SPAWN for pid in s.T_PIDS}
    match, round_ = _setup(events=[s.plant_event(40.0), defuse], positions=far)
    assert find_followup(match, round_, s.tick_of(46), "T") is None
    # CT's own defuse is its historical choice, not independent news.
    assert find_followup(match, round_, s.tick_of(46), "CT") is None


def test_own_team_actions_never_become_the_followup_premise():
    # T plants: news for CT, the T side's own action.
    match, round_ = _setup(events=[s.plant_event(50.0)])
    assert find_followup(match, round_, s.tick_of(45), "T") is None
    assert find_followup(match, round_, s.tick_of(45), "CT")["kind"] == "bomb_planted"
    # A T kills a CT: news for CT, own action for T; a later independent sighting must not be used either,
    # because it would sit on top of the historical kill.
    match, round_ = _setup(events=[s.kill(50.0, "p03", "p07")], spotted=[("p08", ["p01"], 55.0, 56.0)])
    assert find_followup(match, round_, s.tick_of(45), "T") is None
    assert find_followup(match, round_, s.tick_of(45), "CT")["kind"] == "kill"


def test_enemy_smoke_near_a_living_player_is_a_followup_but_a_far_one_is_not():
    near = s.utility_event(52.0, "smoke", "p01", (1100, 1000, "BombsiteA"))
    match, round_ = _setup(events=[near])
    follow = find_followup(match, round_, s.tick_of(45), "CT")
    assert follow["kind"] == "utility_seen"
    assert follow["summary"] == "The attackers detonate a smoke in A site."
    far = s.utility_event(52.0, "smoke", "p01", (9000, 9000, "Zzyzx"))
    match, round_ = _setup(events=[far])
    assert find_followup(match, round_, s.tick_of(45), "CT") is None


def test_followup_of_a_hidden_enemy_never_reveals_ground_truth():
    match, round_ = _setup(events=[s.kill(55.0, "p06", "p01")], positions={"p03": SECRET})
    follow = find_followup(match, round_, s.tick_of(45), "CT")
    assert "Zzyzx" not in json.dumps(follow) and "7777" not in json.dumps(follow)


def test_view_at_the_decision_is_identical_when_the_future_is_cut_off():
    """Whatever happens after the decision tick must not change the decision-time view."""
    events = [s.kill(50.0, "p06", "p03"), s.plant_event(52.0), s.utility_event(53.0, "smoke", "p01", (1100, 1000, "BombsiteA"))]
    match, round_ = _setup(events=events, spotted=[("p04", ["p08"], 60.0, 61.0)])
    tick = s.tick_of(45)
    full = knowledge_view(match, round_, tick, "CT")

    truncated = copy.deepcopy(round_)
    truncated["frames"] = [f for f in truncated["frames"] if f["tick"] <= tick]
    truncated["events"] = [e for e in truncated["events"] if e["tick"] <= tick]
    cut = knowledge_view(s.make_match([truncated]), truncated, tick, "CT")
    assert json.dumps(full, sort_keys=True) == json.dumps(cut, sort_keys=True)
    assert full["bomb"]["status"] == "unknown" and full["alive"] == {"own": 5, "enemy": 5}


def test_new_facts_ignore_mere_ageing_and_smoke_expiry_but_report_a_second_enemy():
    from roundcraft_miner.mine.knowledge import new_facts

    events = [s.utility_event(30.0, "smoke", "p01", (1100, 1000, "BombsiteA"), expiresTick=s.tick_of(40.0))]
    positions = {"p03": JUNGLE, "p04": JUNGLE}
    spotted = [("p03", ["p08"], 38.0, 40.0), ("p04", ["p08"], 44.0, 44.5)]
    match, round_ = _setup(events=events, spotted=spotted, positions=positions, duration=90.0)
    before = knowledge_view(match, round_, s.tick_of(40.0), "CT")
    ageing = knowledge_view(match, round_, s.tick_of(43.0), "CT")  # p03 is now "spotted 3 s ago"; smoke expired
    assert new_facts(before, ageing) == []
    second = knowledge_view(match, round_, s.tick_of(44.0), "CT")  # a second attacker shows up in the same place
    texts = [f["text"] for f in new_facts(before, second)]
    assert any("visible in Jungle right now" in t for t in texts), texts


def test_own_action_before_the_window_opens_also_voids_the_followup():
    # The T side kills a defender 1.5 s after the decision (before the 3 s window). A later, genuinely
    # independent sighting would still describe a round that already follows the historical line.
    events = [s.kill(46.5, "p03", "p07")]
    match, round_ = _setup(events=events, spotted=[("p08", ["p01"], 55.0, 56.0)])
    assert find_followup(match, round_, s.tick_of(45), "T") is None


# --- follow-up independence flags -----------------------------------------------------------------


def _drift(x0, x1, place="Jungle", t0=45.0, t1=52.0):
    """A position that walks from x0 to x1 between t0 and t1 and stays there."""
    return lambda t: (int(x0 + (x1 - x0) * min(1.0, max(0.0, (t - t0) / (t1 - t0)))), 1100, place)


def test_a_sighting_of_an_enemy_who_stood_still_depends_on_our_own_movement():
    match, round_ = _setup(spotted=[("p03", ["p08"], 52.0, 53.0)], positions={"p03": JUNGLE})
    follow = find_followup(match, round_, s.tick_of(45), "CT")
    assert follow["kind"] == "enemy_spotted" and follow["dependsOnOwnMovement"] is True


def test_a_sighting_of_an_enemy_who_moved_a_long_way_does_not_depend_on_our_movement():
    match, round_ = _setup(spotted=[("p03", ["p08"], 52.0, 53.0)], positions={"p03": _drift(300, 1000)})
    follow = find_followup(match, round_, s.tick_of(45), "CT")
    assert follow["kind"] == "enemy_spotted" and follow["dependsOnOwnMovement"] is False


def test_one_enemy_who_moved_makes_the_whole_sighting_independent():
    spotted = [("p03", ["p08"], 52.0, 53.0), ("p04", ["p08"], 52.0, 53.0)]
    match, round_ = _setup(spotted=spotted, positions={"p03": JUNGLE, "p04": _drift(-200, 600, "Connector")})
    assert find_followup(match, round_, s.tick_of(45), "CT")["dependsOnOwnMovement"] is False


def test_enemy_utility_that_only_our_movement_brought_into_range_depends_on_it():
    near = (1100, 1000, "BombsiteA")
    smoke = [s.utility_event(50.0, "smoke", "p01", near)]
    # p08 walks from CT spawn (2500 units away) to the site before the smoke goes off
    moving = {"p08": lambda t: s.CT_SPAWN if t < 47 else s.A_SITE}
    match, round_ = _setup(events=smoke, positions=moving)
    follow = find_followup(match, round_, s.tick_of(45), "CT")
    assert follow["kind"] == "utility_seen" and follow["dependsOnOwnMovement"] is True
    # p08 already stood on the site at the decision: the smoke would have been seen anyway
    match, round_ = _setup(events=smoke)
    follow = find_followup(match, round_, s.tick_of(45), "CT")
    assert follow["kind"] == "utility_seen" and follow["dependsOnOwnMovement"] is False


def test_other_followup_kinds_are_never_movement_dependent():
    match, round_ = _setup(events=[s.plant_event(50.0)])
    follow = find_followup(match, round_, s.tick_of(45), "CT")
    assert follow["kind"] == "bomb_planted" and follow["dependsOnOwnMovement"] is False


def test_reaction_window_is_the_time_from_the_followup_to_the_next_kill():
    kill = s.kill(53.5, "p03", "p07")
    match, round_ = _setup(events=[kill], spotted=[("p04", ["p08"], 52.0, 53.0)], positions={"p04": JUNGLE})
    follow = find_followup(match, round_, s.tick_of(45), "CT")
    assert follow["kind"] == "enemy_spotted" and follow["reactionWindowSeconds"] == 1.5
    match, round_ = _setup(events=[s.kill(70.0, "p03", "p07")], spotted=[("p04", ["p08"], 52.0, 53.0)], positions={"p04": JUNGLE})
    assert find_followup(match, round_, s.tick_of(45), "CT")["reactionWindowSeconds"] == 18.0
    match, round_ = _setup(spotted=[("p04", ["p08"], 52.0, 53.0)], positions={"p04": JUNGLE})
    assert find_followup(match, round_, s.tick_of(45), "CT")["reactionWindowSeconds"] is None


def test_the_followup_kill_itself_and_bomb_kills_do_not_count_as_the_next_kill():
    bomb = s.kill(60.0, "p01", "p06", weapon="planted_c4")
    events = [s.kill(52.0, "p03", "p07"), bomb, s.kill(58.0, "p02", "p09")]
    match, round_ = _setup(events=events)
    follow = find_followup(match, round_, s.tick_of(45), "CT")
    assert follow["kind"] == "kill" and follow["reactionWindowSeconds"] == 6.0


def test_a_newly_seen_bomb_carrier_is_named_as_the_carrier():
    match, round_ = _setup(spotted=[("p01", ["p08"], 52.0, 53.0)], positions={"p01": JUNGLE})
    follow = find_followup(match, round_, s.tick_of(45), "CT")
    assert follow is not None and follow["kind"] == "enemy_spotted"
    assert follow["summary"] == "The bomb carrier appears in Jungle."
