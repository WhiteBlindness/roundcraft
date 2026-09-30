"""Public-information facts: score, pistol round, kill feed, loadout, economy suppression, bomb carrier, plant."""

from __future__ import annotations

import json

import mine_synth as s
from roundcraft_miner.mine.common import pretty_place, weapon_class, weapon_phrase
from roundcraft_miner.mine.knowledge import knowledge_view, new_facts

ZZ = (7777, 8888, "Zzyzx")


def _view(round_, t, perspective="CT", match=None):
    match = match or s.make_match([round_])
    return knowledge_view(match, round_, s.tick_of(t), perspective)


def _texts(view, prefix=None):
    return [f["text"] for f in view["facts"] if prefix is None or f["id"].startswith(prefix)]


def _fact(view, fact_id):
    return next((f for f in view["facts"] if f["id"] == fact_id), None)


# --- 1. score -------------------------------------------------------------------------------------


def test_score_fact_uses_the_scoreboard_by_side_and_is_one_fact():
    round_ = s.make_round(5, score_before={"T": 4, "CT": 10})
    t_view, ct_view = _view(round_, 30, "T"), _view(round_, 30, "CT")
    assert _fact(t_view, "score")["text"] == "Score: your team 4, the defenders 10."
    assert _fact(ct_view, "score")["text"] == "Score: your team 10, the attackers 4."
    assert _fact(ct_view, "score")["status"] == "confirmed" and _fact(ct_view, "score")["basis"] == "public scoreboard"
    assert len([f for f in ct_view["facts"] if f["id"] == "score"]) == 1


def test_score_fact_states_match_point_from_the_halftime_swap_and_skips_overtime():
    first = s.make_round(12, score_before={"T": 5, "CT": 12})
    second = s.make_round(13, score_before={"T": 12, "CT": 5}, flip_sides=True)
    match = s.make_match([first, second])
    # the swap shows the half is 12 rounds, so CT on 12 wins the match with the next round
    assert _fact(_view(first, 30, "CT", match), "score")["text"] == "Score: your team 12, the attackers 5. A round win ends the match for your team."
    assert _fact(_view(second, 30, "T", match), "score")["text"] == "Score: your team 12, the defenders 5. A round win ends the match for your team."
    assert _fact(_view(second, 30, "CT", match), "score")["text"] == "Score: your team 5, the attackers 12. A round win ends the match for the attackers."
    overtime = s.make_round(25, score_before={"T": 12, "CT": 12})
    assert "ends the match" not in _fact(_view(overtime, 30, "CT", s.make_match([first, second, overtime])), "score")["text"]


def test_score_fact_names_the_enemy_when_they_are_on_match_point():
    round_ = s.make_round(9, score_before={"T": 12, "CT": 4})
    assert _fact(_view(round_, 30, "CT"), "score")["text"].endswith("A round win ends the match for the attackers.")


# --- 2. pistol round ------------------------------------------------------------------------------


def test_pistol_round_is_round_one_and_the_first_round_after_the_side_swap_only():
    rounds = [s.make_round(n, flip_sides=n >= 4) for n in (1, 2, 3, 4, 5)]
    match = s.make_match(rounds)
    pistol = [r["number"] for r in rounds if _fact(_view(r, 30, "CT", match), "pistol_round")]
    assert pistol == [1, 4]
    fact = _fact(_view(rounds[3], 30, "CT", match), "pistol_round")
    assert fact["text"] == "This is the first round of the half (pistol round)." and fact["basis"] == "round number"
    assert fact["status"] == "confirmed"


def test_a_later_overtime_swap_is_not_a_pistol_round():
    rounds = [s.make_round(1), s.make_round(2, flip_sides=True), s.make_round(3), s.make_round(4, flip_sides=True)]
    match = s.make_match(rounds)
    assert [bool(_fact(_view(r, 30, "CT", match), "pistol_round")) for r in rounds] == [True, True, False, False]


# --- 3. kill feed ---------------------------------------------------------------------------------


def test_kill_feed_states_an_own_loss_with_place_and_weapon_but_never_the_killers_position():
    kill = s.kill(28.0, "p03", "p07", weapon="m4a1_silencer", at=s.MIDDLE)
    kill["data"]["attackerPlace"] = "Zzyzx"
    kill["data"]["attackerX"], kill["data"]["attackerY"] = 7777, 8888
    round_ = s.make_round(1, events=[kill])
    view = _view(round_, 30)
    assert _texts(view, "kill_feed") == ["A teammate was killed in Middle 2 s ago by an M4A1-S."]
    assert "Zzyzx" not in json.dumps(view) and "7777" not in json.dumps(view)
    assert not any(pid in f["text"] for f in view["facts"] for pid in s.T_PIDS + s.CT_PIDS)


def test_kill_feed_omits_the_place_of_an_enemy_victim_no_own_player_saw():
    # p03 (T) dies to an unattributed source (no own killer) and nobody on CT was seeing him.
    kill = s.kill(25.0, "p01", "p03", at=s.JUNGLE)
    kill["data"].update(attacker=None, attackerSide=None, weapon="world")
    view = _view(s.make_round(1, events=[kill]), 30)
    assert _texts(view, "kill_feed") == ["An attacker was killed 5 s ago."]


def test_kill_feed_gives_the_enemy_victims_place_when_an_own_player_saw_or_killed_him():
    unattributed = s.kill(25.0, "p01", "p03", at=s.JUNGLE)
    unattributed["data"].update(attacker=None, attackerSide=None, weapon="world")
    seen = s.make_round(1, events=[unattributed], spotted=[("p03", ["p08"], 22.0, 24.5)])
    assert _texts(_view(seen, 30), "kill_feed") == ["An attacker was killed in Jungle 5 s ago."]
    # seen only long before the kill: not enough to place the victim
    stale = s.make_round(1, events=[unattributed], spotted=[("p03", ["p08"], 10.0, 12.0)])
    assert _texts(_view(stale, 30), "kill_feed") == ["An attacker was killed 5 s ago."]
    by_us = s.make_round(1, events=[s.kill(25.0, "p08", "p03", at=s.JUNGLE)])
    assert _texts(_view(by_us, 30), "kill_feed") == ["An attacker was killed in Jungle 5 s ago."]
    for_t = s.make_round(1, events=[s.kill(25.0, "p03", "p07", at=s.JUNGLE)])  # T perspective: victim is on the other team
    assert _texts(_view(for_t, 30, "T"), "kill_feed") == ["A defender was killed in Jungle 5 s ago."]


def test_kill_feed_ignores_old_bomb_and_unattributed_victimless_kills_and_groups_several():
    bomb = s.kill(28.0, "p01", "p06", weapon="planted_c4")
    bomb["data"]["attackerSide"] = None
    nobody = s.kill(28.5, "p01", "p06")
    nobody["data"]["victim"] = None
    events = [
        s.kill(10.0, "p03", "p06", weapon="ak47", at=s.MIDDLE),  # 20 s old
        bomb, nobody,
        s.kill(26.0, "p03", "p07", weapon="ak47", at=s.MIDDLE),
        s.kill(29.0, "p02", "p09", weapon="awp", at=s.MIDDLE),
    ]
    view = _view(s.make_round(1, events=events), 30)
    assert _texts(view, "kill_feed") == ["Two teammates were killed in Middle 1 to 4 s ago by an AK-47 and an AWP."]
    assert len({f["id"] for f in view["facts"]}) == len(view["facts"])


def test_kill_feed_facts_are_not_repeated_as_news_when_they_merely_age():
    round_ = s.make_round(1, events=[s.kill(28.0, "p03", "p07", at=s.MIDDLE)])
    match = s.make_match([round_])
    before, after = _view(round_, 30, "CT", match), _view(round_, 33, "CT", match)
    assert not [f for f in new_facts(before, after) if f["id"].startswith("kill_feed")]


# --- 4. economy suppression -----------------------------------------------------------------------


def _economy_match(**kwargs):
    r1 = s.make_round(1, winner="CT", end_reason="ct_win_elimination")
    r2 = s.make_round(2, winner="CT", end_reason="ct_win_elimination", score_before={"T": 0, "CT": 1})
    r3 = s.make_round(3, score_before={"T": 0, "CT": 2}, **kwargs)
    return s.make_match([r1, r2, r3]), r3


def test_reduced_buy_inference_stands_without_contrary_evidence():
    match, r3 = _economy_match()
    fact = _fact(knowledge_view(match, r3, s.tick_of(30), "CT"), "econ_enemy_reduced")
    assert fact and fact["status"] == "inferred"


def test_reduced_buy_inference_is_dropped_after_seeing_an_enemy_rifle():
    match, r3 = _economy_match(spotted=[("p03", ["p08"], 20.0, 21.0)])  # the default T weapon is an AK-47
    assert not _fact(knowledge_view(match, r3, s.tick_of(30), "CT"), "econ_enemy_reduced")
    assert _fact(knowledge_view(match, r3, s.tick_of(15), "CT"), "econ_enemy_reduced")  # before the sighting


def test_reduced_buy_inference_ignores_pistol_sightings_and_pistol_kills_but_drops_for_a_rifle_kill():
    match, r3 = _economy_match(spotted=[("p03", ["p08"], 20.0, 21.0)], weapons={"p03": "Glock-18"})
    assert _fact(knowledge_view(match, r3, s.tick_of(30), "CT"), "econ_enemy_reduced")
    match, r3 = _economy_match(events=[s.kill(22.0, "p03", "p07", weapon="glock")])
    assert _fact(knowledge_view(match, r3, s.tick_of(30), "CT"), "econ_enemy_reduced")
    match, r3 = _economy_match(events=[s.kill(22.0, "p03", "p07", weapon="mac10")])
    assert not _fact(knowledge_view(match, r3, s.tick_of(30), "CT"), "econ_enemy_reduced")
    match, r3 = _economy_match(events=[s.kill(22.0, "p03", "p07", weapon="awp")])
    assert not _fact(knowledge_view(match, r3, s.tick_of(30), "CT"), "econ_enemy_reduced")
    match, r3 = _economy_match(events=[s.kill(22.0, "p08", "p03", weapon="ak47")])  # our own rifle kill says nothing
    assert _fact(knowledge_view(match, r3, s.tick_of(30), "CT"), "econ_enemy_reduced")


# --- 5. bomb carrier dedupe -----------------------------------------------------------------------


def test_bomb_carrier_and_the_same_enemy_sighting_are_one_fact():
    round_ = s.make_round(1, carrier="p01", spotted=[("p01", ["p08"], 10.0, 11.0)], positions={"p01": (2000, -1000, "TRamp")}, weapons={"p01": "Desert Eagle"})
    view = _view(round_, 24)
    carrier = _fact(view, "bomb_carrier_tramp")
    assert carrier["text"] == "The bomb carrier was last seen in T Ramp 13 s ago with a Desert Eagle." and carrier["status"] == "last_seen"
    assert not [f for f in view["facts"] if f["id"].startswith("last_seen_")]  # not repeated in the grouped sightings
    assert _texts(view).count(carrier["text"]) == 1
    assert "p01" not in json.dumps(view["facts"])


def test_bomb_carrier_dedupe_leaves_other_enemies_in_the_sightings():
    round_ = s.make_round(1, carrier="p01", spotted=[("p01", ["p08"], 10.0, 11.0), ("p03", ["p08"], 10.0, 11.0)], weapons={"p01": "Desert Eagle"})
    view = _view(round_, 24)
    assert [f["text"] for f in view["facts"] if f["id"].startswith("last_seen_")] == ["One attacker was last seen in Jungle 13 s ago with an AK-47."]
    assert any(f["id"].startswith("bomb_carrier") and "with a Desert Eagle" in f["text"] for f in view["facts"])


# --- 6. plant inference ---------------------------------------------------------------------------


def test_ct_infers_an_attacker_at_the_site_only_for_a_fresh_plant():
    round_ = s.make_round(1, events=[s.plant_event(40.0)])
    fresh = _fact(_view(round_, 44), "plant_inference")
    assert fresh["status"] == "inferred" and fresh["basis"] == "plant announcement"
    assert fresh["text"] == "The bomb was planted 4 s ago, so at least one attacker was at site A moments ago."
    assert not _fact(_view(round_, 52), "plant_inference")  # 12 s old
    assert not _fact(_view(round_, 44, "T"), "plant_inference")  # the planting side knows more, not less


# --- 7. loadout -----------------------------------------------------------------------------------


def test_own_loadout_fact_lists_weapons_hp_and_armour_in_positions_order():
    positions = {"p06": s.CT_SPAWN, "p07": s.CT_SPAWN, "p08": s.A_SITE, "p09": s.A_SITE, "p10": s.B_SITE}
    kills = [s.kill(5.0, "p01", "p09"), s.kill(5.0, "p01", "p10"), s.kill(5.0, "p01", "p07")]
    over = {"p06": {"primary": "SSG 08", "hp": 100, "armor": 0, "helmet": False}, "p08": {"primary": "AK-47", "hp": 96, "armor": 0, "helmet": False}}
    round_ = s.make_round(1, events=kills, positions=positions, overrides=over)
    view = _view(round_, 30)
    assert _fact(view, "own_loadout")["text"] == "Your players: AK-47 + USP-S, 96 HP, no armour; SSG 08 + USP-S, 100 HP, no armour."
    assert _fact(view, "own_loadout")["status"] == "confirmed"


def test_own_loadout_falls_back_to_a_summary_when_too_long():
    over = {pid: {"primary": "AK-47", "secondary": "Desert Eagle", "hp": 100 - i, "armor": 100, "helmet": True} for i, pid in enumerate(s.CT_PIDS)}
    over["p06"]["primary"] = "SSG 08"
    round_ = s.make_round(1, overrides=over)
    text = _fact(_view(round_, 30), "own_loadout")["text"]
    assert text == "Your players have 100, 99, 98, 97, 96 HP; four AK-47s, one SSG 08; all armoured."
    assert len(text) <= 200


# --- 10. wording ----------------------------------------------------------------------------------


def test_mirage_place_override_and_weapon_helpers():
    assert pretty_place("SnipersNest") == "Sniper's Nest"
    assert weapon_phrase("m4a1_silencer") == "an M4A1-S" and weapon_phrase("knife") is None
    assert weapon_class("ak47") == "rifle" and weapon_class("SSG 08") == "sniper" and weapon_class("Glock-18") == "pistol"
