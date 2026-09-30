"""Objective defects found by editorial review: impossible options, call-dependent follow-up wording, evidence
coverage, reveal completeness, tooling language, follow-up caveats, utility-free debriefs, focus and place labels."""

from __future__ import annotations

import itertools
from types import SimpleNamespace
import json
import re

import pytest

from draft_support import candidate, candidate_dir, clone, load_fixture, retake, temp_repo  # noqa: F401
from roundcraft_miner.draft import case_draft
from roundcraft_miner.draft.case_draft import build_case, player_facing_text
from roundcraft_miner.draft.features import Features, KnownEnemyView, extract_features
from roundcraft_miner.draft.priors import Signal, compute_main_prior
from roundcraft_miner.draft.review import render_review
from roundcraft_miner.draft.templates import SITUATIONS, fill
from roundcraft_miner.draft.text import pretty_place

TOOLING = re.compile(r"\b(mined|mining|demos?|candidates?|heuristics?|heuristic|templates?|templated)\b", re.IGNORECASE)
RAW_REASON = re.compile(r"win elimination|t_win|ct_win|bomb_defused|bomb_exploded", re.IGNORECASE)


@pytest.fixture
def two_alive() -> dict:
    return load_fixture("candidate_ct_hold_two_alive")


def _labels(case: dict) -> list[str]:
    return [q["label"] for q in case["brief"]["qualifiers"]] + [a["label"] for a in case["brief"]["actions"]]


def _features(situation: str, *, own: int, util: int, known: bool, planted: bool = False, time: float = 40.0) -> Features:
    perspective = "CT" if situation in ("retake", "hold_or_rotate") else "T"
    known_enemies = [KnownEnemyView("Connector", "last_seen", 4.0, None)] if known else []
    return Features(
        situation=situation, perspective=perspective, map_name="de_mirage", time_left=time,
        time_kind="bomb" if planted else "round", own_alive=own, enemy_alive=3,
        own_kit=0, util={"smoke": util, "flash": 0, "he": 0, "molotov": 0, "decoy": 0},
        known_enemies=known_enemies, unknown_enemies=3 - len(known_enemies), observed_enemy_utility=[],
        bomb_status="planted" if planted else "carried", bomb_place=None, bomb_site=None, enemy_noun="attacker",
    )


# --- 1. impossible options ----------------------------------------------------------------------------------


def test_two_alive_hold_offers_no_impossible_options(two_alive):
    case = build_case(two_alive)
    labels = _labels(case)
    assert "Rotate two players and leave one behind" not in labels
    assert "Rotate one player and keep the rest in place" not in labels
    assert "Rotate one player and keep the other in place" in labels
    assert "Probe the nearest known contact" not in labels  # nothing is known to probe
    assert all("known position" not in label for label in labels)
    assert "Use utility to delay the first contact" not in labels  # no utility
    for action in case["brief"]["actions"]:
        assert len(action["qualifierIds"]) >= 2
    qualifier_ids = [q["id"] for q in case["brief"]["qualifiers"]]
    assert len(qualifier_ids) == len(set(qualifier_ids))
    assert len(labels) == len(set(labels))


def test_probe_needs_a_known_enemy_and_keeps_its_label_when_one_exists(candidate):
    features = extract_features(candidate)
    labels = _labels(build_case(candidate))
    if features.situation == "execute_or_default":
        assert ("Probe the nearest known contact" in labels) == (features.place is not None)


def test_nearest_contact_probe_falls_back_without_known_enemy_and_with_two_players():
    sit = SITUATIONS["execute_or_default"]
    none_known = compute_main_prior(sit, _features("execute_or_default", own=3, util=2, known=False))
    by_id = {a.template.id: a for a in none_known.actions}
    probe = {q.id: q.label for q in by_id["default_take_info"].qualifiers}
    assert probe == {"play_slow_listen": "Play slowly and listen for rotations",
                     "probe_with_one": "Probe with one player while the others hold"}
    two = compute_main_prior(sit, _features("execute_or_default", own=2, util=2, known=False))
    assert {q.label for a in two.actions if a.template.id == "default_take_info" for q in a.qualifiers} >= {
        "Probe with one player while the other holds"}
    known = compute_main_prior(sit, _features("execute_or_default", own=3, util=2, known=True))
    assert "Probe the nearest known contact" in {q.label for a in known.actions for q in a.qualifiers}


def test_retake_probe_wording_and_known_position_qualifiers(retake, clone):
    two = clone(retake)
    two["playerKnown"]["own"] = two["playerKnown"]["own"][:2]
    two["playerKnown"]["alive"]["own"] = 2
    labels = _labels(build_case(two))
    assert "Send one player ahead to probe while the other follows" in labels
    assert "Send one player ahead to probe while the rest follow" not in labels
    three = _labels(build_case(retake))
    assert "Send one player ahead to probe while the rest follow" in three
    stale = clone(retake)
    for enemy in stale["playerKnown"]["enemies"]:
        if enemy.get("place"):
            enemy["ageSeconds"] = 40.0
    assert all("known position" not in label for label in _labels(build_case(stale)))
    assert any("known position" in label for label in three)


@pytest.mark.parametrize("situation", sorted(SITUATIONS))
def test_every_state_offers_valid_distinct_possible_options(situation):
    sit = SITUATIONS[situation]
    for own, util, known, planted in itertools.product((2, 3, 5), (0, 1, 3), (False, True), (False, True)):
        if (situation in ("retake", "post_plant_hold")) != planted:
            continue
        prior = compute_main_prior(sit, _features(situation, own=own, util=util, known=known, planted=planted))
        assert 3 <= len(prior.actions) <= 5
        labels = []
        for action in prior.actions:
            assert len(action.qualifiers) >= 2, (situation, own, util, known, action.template.id)
            ids = [q.id for q in action.qualifiers]
            assert len(ids) == len(set(ids))
            labels += [q.label for q in action.qualifiers]
            for q in action.qualifiers:
                if own < 3:
                    assert "leave one behind" not in q.label
                if own == 2:
                    assert "the rest" not in q.label and "the others" not in q.label, q.label
                if not known:
                    assert "known position" not in q.label and "known contact" not in q.label
                if util == 0:
                    assert not re.search(r"\butility\b", q.label.replace("instead of utility", "")), q.label
        assert len(labels) == len(set(labels))


def test_fall_back_label_reflects_that_nothing_is_planted(two_alive, retake):
    labels = [a["label"] for a in build_case(two_alive)["brief"]["actions"]]
    assert "Fall back and play for a retake if they plant" in labels
    assert "Fall back and play for the retake" not in labels
    sit = SITUATIONS["hold_or_rotate"]
    planted = compute_main_prior(sit, _features("hold_or_rotate", own=3, util=1, known=True, planted=True))
    assert "Fall back and play for the retake" in [a.label for a in planted.actions]


# --- 2. follow-up wording is call-agnostic -------------------------------------------------------------------


def test_followup_labels_are_call_agnostic_and_issue_is_recorded(candidate):
    case = build_case(candidate)
    labels = {r["id"]: r["label"] for r in case["followup"]["responses"]}
    assert labels["continue_plan"] == "Stick to the line you chose"
    assert labels["adjust_to_new_info"] == "Change your line to use the new information"
    assert labels["take_more_info"] == "Slow down and gather more information"
    for label in labels.values():
        assert not re.search(r"\b(retake|setup|plan|positions)\b", label, re.IGNORECASE) or label.startswith("Drop the line"), label
    assert any("independent of the main call" in issue for issue in case["editorial"]["knownIssues"])
    for response in SITUATIONS.values():
        assert {r.id for r in response.responses} == {"continue_plan", "adjust_to_new_info", "take_more_info", "fall_back"}


# --- 3. evidence review coverage ---------------------------------------------------------------------------


def test_evidence_review_covers_every_evidence_option(candidate):
    case = build_case(candidate)
    evidence_ids = [e["id"] for e in case["brief"]["evidence"]]
    reviewed = [r["evidenceId"] for r in case["reveal"]["debrief"]["evidenceReview"]]
    assert sorted(reviewed) == sorted(evidence_ids)
    assert len(set(reviewed)) == len(reviewed)
    texts = [r["explanation"] for r in case["reveal"]["debrief"]["evidenceReview"]]
    assert len(set(texts)) == len(texts)


def test_evidence_sentences_are_factual_and_grounded(retake, clone):
    f = extract_features(retake)
    view = retake["playerKnown"]
    sentence = case_draft._evidence_sentence
    one_he = clone(f)
    one_he.util = {"smoke": 0, "flash": 0, "he": 1, "molotov": 0, "decoy": 0}
    assert sentence(Signal("own_utility", "own_utility", "x"), one_he, view).startswith(
        "The team had one HE grenade and no smokes, flashes or molotovs")
    none = clone(f)
    none.util = {k: 0 for k in f.util}
    assert sentence(Signal("own_utility", "own_utility", "x"), none, view) == "The team had no utility left."
    mixed = clone(f)
    mixed.util = {"smoke": 0, "flash": 0, "he": 1, "molotov": 0, "decoy": 0}
    assert "no smokes" in sentence(Signal("own_utility", "own_utility", "x"), mixed, view)
    no_kit, both = clone(f), clone(f)
    no_kit.own_kit, no_kit.own_alive = 0, 2
    both.own_kit, both.own_alive = 2, 2
    assert sentence(Signal("defuse_kit", "defuse_kit", "x"), no_kit, view) == \
        "No one carried a defuse kit, so a defuse needed about 10 seconds."
    assert sentence(Signal("defuse_kit", "defuse_kit", "x"), both, view) == \
        "Both players carried defuse kits, so a defuse needed about 5 seconds."
    assert sentence(Signal("alive_count", "alive_count", "x"), f, view) == "It was 3 players against 3."


def test_evidence_review_entries_fit_the_reveal_schema(candidate):
    case = build_case(candidate)
    entries = case["reveal"]["debrief"]["evidenceReview"]
    assert 1 <= len(entries) <= 5
    assert all(1 <= len(e["explanation"]) <= 1200 for e in entries)


# --- 4. reveal uses the full timeline -----------------------------------------------------------------------


def _long_timeline(retake: dict, clone):
    variant = clone(retake)
    events = []
    for i in range(10):
        events.append({"type": "utility", "description": f"p0{i % 9 + 1} (CT) detonated a flash in Palace", "offsetSeconds": i + 1.0})
    kills = [("CT", "T", "Stairs", 12.0), ("T", "CT", "Connector", 14.0), ("CT", "T", "Palace", 16.0)]
    for attacker, victim, place, at in kills:
        events.append({"type": "kill", "description": f"p01 ({attacker}) killed p02 ({victim}) with ak47 in {place}", "offsetSeconds": at})
    events += [
        {"type": "bomb_defuse_begin", "description": "p03 began defusing at A", "offsetSeconds": 18.0},
        {"type": "bomb_defuse_begin", "description": "p03 began defusing at A", "offsetSeconds": 25.0},
        {"type": "kill", "description": "p04 (T) killed p03 (CT) with glock in A site", "offsetSeconds": 26.0},
        {"type": "round_end", "offsetSeconds": 30.0, "endReason": "t_win_elimination", "winner": "T"},
    ]
    variant["groundTruth"]["timelineAfter"] = events
    variant["groundTruth"]["outcome"] = {"bombOutcome": "planted", "endReason": "t_win_elimination", "enemySurvivors": 2,
                                          "ownSurvivors": 0, "perspectiveWon": False, "winner": "T"}
    variant["actualLine"] = "HISTORICAL LINE (x). Over the next 10 s: 3 players held position in Ramp. Result: T won the round (t win elimination); 0 of the team survived."
    return variant


def test_reveal_keeps_the_decisive_last_events_and_the_round_end(retake, clone):
    case = build_case(_long_timeline(retake, clone))
    events = case["reveal"]["continuation"]["events"]
    assert len(events) == 12
    assert "round ended" in events[-1]["action"] and "Ts won by eliminating the defenders" in events[-1]["action"]
    assert events[-1]["state"].startswith("Alive: 0 for your team")
    assert any("began defusing" in e["action"] for e in events)
    assert events[0]["action"].startswith("In the source round, ")
    assert all("In the source round" not in e["action"] for e in events[1:])
    assert any("shows 12" in issue for issue in case["editorial"]["knownIssues"])


def test_end_reasons_are_readable_and_defuse_attempts_are_named(retake, clone):
    variant = _long_timeline(retake, clone)
    case = build_case(variant)
    action = case["reveal"]["comparison"]["roundAction"]
    assert "The Ts won by eliminating the defenders; none of your team survived." in action
    assert "Defuses began 18 s and 25 s after the decision; none was completed." in action
    assert action.startswith("In the source round, over the next 10 s")
    for text in player_facing_text(case):
        assert not RAW_REASON.search(text), text
    variant["groundTruth"]["timelineAfter"][-1].pop("endReason")  # older shapes still render
    assert "eliminating the defenders" in " ".join(player_facing_text(build_case(variant)))


def test_a_timeline_that_stops_early_is_closed_from_the_outcome(retake, clone):
    variant = clone(retake)
    variant["groundTruth"]["timelineAfter"] = variant["groundTruth"]["timelineAfter"][:2]
    case = build_case(variant)
    last = case["reveal"]["continuation"]["events"][-1]
    assert last["timestamp"] == "Round end" and "bomb was defused" in last["action"]
    assert any("closing reveal event" in issue for issue in case["editorial"]["knownIssues"])
    for event in case["reveal"]["continuation"]["events"]:
        assert not re.search(r"\bp\d{2}\b", json.dumps(event))


def test_utility_and_plant_wording_in_events(retake, clone):
    variant = clone(retake)
    variant["groundTruth"]["timelineAfter"] = [
        {"type": "utility", "description": "p01 (CT) detonated a he in Banana", "offsetSeconds": 1.0},
        {"type": "bomb_defuse_begin", "description": "p02 began defusing at A", "offsetSeconds": 5.0},
    ]
    events = build_case(variant)["reveal"]["continuation"]["events"]
    assert "threw an HE grenade that detonated in Banana" in events[0]["action"]
    assert "a CT player began defusing" in events[1]["action"] or "A CT player began defusing" in events[1]["action"]


# --- 5. no tooling language ---------------------------------------------------------------------------------


def test_player_facing_text_has_no_tooling_language(candidate):
    case = build_case(candidate)
    for text in player_facing_text(case):
        assert not TOOLING.search(text), text


def test_no_followup_reads_naturally_with_real_clock_arithmetic():
    cand = load_fixture("candidate_ct_hold_nofollowup")
    case = build_case(cand)
    followup = case["followup"]
    assert followup["heading"] == "The clock runs down"
    assert followup["stimulus"] == "About 8 seconds pass without new contact; the round clock now shows 54 s."
    assert {u["status"] for u in followup["updates"]} == {"unchanged", "changed"}
    assert any("About 54 seconds now remain" in u["text"] for u in followup["updates"])
    assert ("Follow-up must be authored: the first change after the decision in the source round "
            "was the team's own action.") in case["editorial"]["knownIssues"]
    assert "Time passes" not in json.dumps(followup)
    assert "mined" not in case["reveal"]["comparison"]["materialInformation"]
    assert "mined" not in case["reveal"]["debrief"]["followupReview"]


def test_no_followup_bomb_timer_and_urgent_state(retake, clone):
    variant = clone(retake)
    variant["followUp"] = None
    text = build_case(variant)["followup"]["stimulus"]
    assert text == "About 8 seconds pass without new contact; the bomb timer now shows 23 s."
    short = clone(retake)
    short["followUp"] = None
    short["playerKnown"]["clock"]["bombSecondsLeft"] = 14.0
    case = build_case(short)
    assert case["followup"]["stimulus"].endswith("the bomb timer now shows 6 s.")
    qualities = {r["responseId"]: r["quality"] for r in case["rubric"]["followup"]["responses"]}
    assert max(qualities, key=qualities.get) == "fall_back"  # the clock makes a retake impossible: urgent table


# --- 6. follow-up caveats --------------------------------------------------------------------------------


def test_followup_dependence_and_short_window_are_recorded(two_alive, tmp_path):
    case = build_case(two_alive)
    issues = case["editorial"]["knownIssues"]
    assert any("depends on the team's own movement" in issue for issue in issues)
    assert any("reaction window is only 1.2 s" in issue for issue in issues)
    review = render_review(tmp_path / "candidate.json", two_alive, case, {"validated": False})
    section = review.split("### Follow-up assumptions to dispute")[1].split("## Alternative")[0]
    assert "depends on the team's own movement" in section and "reaction window is only 1.2 s" in section


def test_missing_or_benign_followup_fields_add_no_caveat(retake, clone, two_alive):
    assert not any("depends on the team" in i or "reaction window" in i for i in build_case(retake)["editorial"]["knownIssues"])
    calm = clone(two_alive)
    calm["followUp"]["dependsOnOwnMovement"] = False
    calm["followUp"]["reactionWindowSeconds"] = 3.5
    assert not any("depends on the team" in i or "reaction window" in i for i in build_case(calm)["editorial"]["knownIssues"])
    none_window = clone(two_alive)
    none_window["followUp"]["reactionWindowSeconds"] = None
    assert not any("reaction window" in i for i in build_case(none_window)["editorial"]["knownIssues"])


def test_followup_caveats_never_change_the_brief(two_alive, clone):
    plain = clone(two_alive)
    del plain["followUp"]["dependsOnOwnMovement"], plain["followUp"]["reactionWindowSeconds"]
    assert build_case(plain)["brief"] == build_case(two_alive)["brief"]


# --- 7. debrief does not contradict the brief -------------------------------------------------------------


@pytest.mark.parametrize("action_id", ["group_retake", "commit_execute", "fake_and_rotate"])
def test_utility_free_debrief_variants(action_id):
    action = next(a for sit in SITUATIONS.values() for a in sit.actions if a.id == action_id)
    none = _features("retake", own=3, util=0, known=True)
    some = _features("retake", own=3, util=3, known=True)
    for field_name in ("why", "cost", "assumption", "breaks", "alt", "cf_effect"):
        text = getattr(action, field_name)
        assert "[[" not in fill(text, none) and "[[" not in fill(text, some)
        assert not re.search(r"\butility\b", fill(text, none).replace("its own utility", "")), (field_name, fill(text, none))
        assert "  " not in fill(text, none)
    assert any("utility" in fill(getattr(action, n), some) for n in ("why", "cost", "breaks", "alt"))


def test_group_arrival_is_phrased_as_rationale_not_as_what_happened():
    why = next(a for a in SITUATIONS["retake"].actions if a.id == "group_retake").why
    assert why.startswith("The case for arriving as one group is that")


def test_retake_without_utility_does_not_mention_utility_in_debrief(retake, clone):
    bare = clone(retake)
    for player in bare["playerKnown"]["own"]:
        player["utility"] = {k: 0 for k in player["utility"]}
    bare["playerKnown"]["facts"] = [f for f in bare["playerKnown"]["facts"] if "utility" not in f["text"].lower()]
    case = build_case(bare)
    debrief = case["reveal"]["debrief"]
    for key in ("whyItWorks", "cost", "assumption", "breaksWhen", "strongestAlternative"):
        assert "utility" not in debrief[key].lower(), (key, debrief[key])


# --- 8. focus ----------------------------------------------------------------------------------------------


def _execute(retake: dict, clone, seconds: float) -> dict:
    from test_draft_case import _as_t_precommit

    variant = _as_t_precommit(retake, clone)
    variant["playerKnown"]["clock"]["roundSecondsLeft"] = seconds
    return variant


def test_focus_matches_the_presented_situation(retake, clone):
    plant_or_save = build_case(_execute(retake, clone, 14.0))
    assert plant_or_save["brief"]["title"].startswith("Plant or save")
    assert plant_or_save["brief"]["focus"] == "Trying to plant with the clock nearly gone versus saving the weapons"
    assert "information first" not in plant_or_save["brief"]["focus"]
    short = build_case(_execute(retake, clone, 35.0))
    assert short["brief"]["focus"] == "Committing to a plant with the round clock running short"
    long = build_case(_execute(retake, clone, 80.0))
    assert long["brief"]["focus"] == SITUATIONS["execute_or_default"].focus


def test_focus_is_mirrored_in_public_metadata_and_within_limits(candidate, retake, clone):
    for cand in (candidate, _execute(retake, clone, 14.0)):
        case = build_case(cand)
        assert case["edition"]["publicMetadata"]["focus"] == case["brief"]["focus"]
        assert 1 <= len(case["brief"]["focus"]) <= 80
    for sit in SITUATIONS.values():
        assert len(sit.focus) <= 80


def test_title_names_a_dropped_bomb(retake, clone):
    variant = _execute(retake, clone, 78.0)
    variant["playerKnown"]["bomb"] = {"status": "dropped", "knowledge": "confirmed", "place": "Ramp"}
    assert build_case(variant)["brief"]["title"].endswith("left and the bomb on the ground on Mirage") or \
        "and the bomb on the ground" in build_case(variant)["brief"]["title"]


# --- 9. place labels --------------------------------------------------------------------------------------


def test_sniper_nest_label_mirrors_the_miner():
    assert pretty_place("SnipersNest") == "Sniper's Nest"
    assert pretty_place("Sniper's Nest") == "Sniper's Nest"
    assert pretty_place("Snipers Nest") == "Sniper's Nest"
    assert pretty_place("TopofMid") == "Top of Mid"
    assert pretty_place("BombsiteA") == "A site"


def test_plural_weapon_names_take_no_article(retake, clone):
    variant = clone(retake)
    variant["playerKnown"]["facts"][0]["text"] = "One attacker was last seen in Middle 22 s ago with a Dual Berettas."
    texts = [f["text"] for f in build_case(variant)["brief"]["facts"]]
    assert any(t.endswith("with Dual Berettas.") for t in texts)


# --- 10. defects found while previewing the shortlist ------------------------------------------------------------


def test_a_fresh_and_a_stale_sighting_in_one_place_stay_separate_evidence():
    from roundcraft_miner.draft.priors import seen_groups

    fresh = KnownEnemyView(place="T Ramp", status="confirmed", age=1.5, weapon="deagle")
    stale = KnownEnemyView(place="T Ramp", status="last_seen", age=13.0, weapon=None)
    pair = KnownEnemyView(place="T Ramp", status="confirmed", age=2.0, weapon=None)
    assert [count for _, count in seen_groups(SimpleNamespace(known_enemies=[fresh, stale]))] == [1, 1]
    assert [count for _, count in seen_groups(SimpleNamespace(known_enemies=[fresh, pair, stale]))] == [2, 1]


def test_a_defuse_that_ends_the_round_is_not_followed_by_a_second_round_end(retake, clone):
    variant = clone(retake)
    variant["groundTruth"]["timelineAfter"] = [
        {"type": "bomb_defuse_begin", "description": "p03 began defusing at A", "offsetSeconds": 15.0},
        {"type": "bomb_defused", "description": "p03 defused the bomb at A", "offsetSeconds": 25.0},
        {"type": "round_end", "offsetSeconds": 25.0, "endReason": "bomb_defused", "winner": "CT"},
    ]
    events = build_case(variant)["reveal"]["continuation"]["events"]
    assert "defused" in events[-1]["action"]
    assert sum("round ended" in e["action"].lower() or "round ended" in e["consequence"].lower() for e in events) == 1


def test_enemy_utility_followups_read_as_utility_not_as_a_sighting():
    assert case_draft._heading("utility_seen") == "New enemy utility"
    assert case_draft._heading("enemy_spotted") == "A new sighting"


def test_a_single_grenade_does_not_make_a_utility_plan():
    one = SimpleNamespace(util_total=1)
    two = SimpleNamespace(util_total=2)
    text = "Taking space[[ with utility]] works."
    assert fill(text, one) == "Taking space works."
    assert fill(text, two) == "Taking space with utility works."
