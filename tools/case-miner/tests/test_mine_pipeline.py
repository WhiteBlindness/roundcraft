"""End-to-end pipeline on the synthetic fixture: stable ids, index, listing, leak separation."""

from __future__ import annotations

import json

import mine_synth as s
import pytest
from roundcraft_miner import paths
from roundcraft_miner.mine.pipeline import list_candidates, mine_match, mine_source
from roundcraft_miner.model import candidate_id, read_json, write_json

SOURCE_ID = "src_synth"
SECRET = (7777, 8888, "Zzyzx")


@pytest.fixture()
def data_root(tmp_path, monkeypatch):
    monkeypatch.setenv("ROUNDCRAFT_DATA", str(tmp_path / "data"))
    monkeypatch.setenv("ROUNDCRAFT_MANIFESTS", str(tmp_path / "manifests"))
    return tmp_path / "data"


def _install(match, source_id=SOURCE_ID):
    write_json(paths.parsed_dir(source_id) / "match.json", match)


def _fixture():
    """The synthetic post-plant match, round-tripped through JSON like a parsed match.json."""
    return json.loads(json.dumps(s.post_plant_match()))


def test_mine_source_writes_candidates_and_a_sorted_index(data_root):
    _install(_fixture())
    written = mine_source(SOURCE_ID)
    assert written and all(p.name == "candidate.json" for p in written)
    index = read_json(paths.candidates_dir(SOURCE_ID) / "index.json")
    assert [row["score"] for row in index] == sorted((row["score"] for row in index), reverse=True)
    assert {row["candidateId"] for row in index} == {p.parent.name for p in written}
    for row in index:
        assert set(row) >= {"id", "candidateId", "round", "tick", "perspective", "category", "score", "summary"}
    candidate = read_json(written[0])
    assert candidate["candidateId"] == candidate_id(_fixture()["demoSha256"], candidate["round"], candidate["decisionTick"], candidate["perspective"], candidate["category"])


def test_candidate_ids_and_bytes_are_stable_across_two_runs(data_root):
    _install(_fixture())
    first = {p.parent.name: p.read_bytes() for p in mine_source(SOURCE_ID)}
    index_first = (paths.candidates_dir(SOURCE_ID) / "index.json").read_bytes()
    second = {p.parent.name: p.read_bytes() for p in mine_source(SOURCE_ID)}
    assert first == second
    assert index_first == (paths.candidates_dir(SOURCE_ID) / "index.json").read_bytes()


def test_min_score_filters_and_stale_candidate_dirs_are_removed(data_root):
    _install(_fixture())
    everything = mine_source(SOURCE_ID)
    strict = mine_source(SOURCE_ID, min_score=0.8)
    assert 0 < len(strict) < len(everything)
    on_disk = {p.name for p in paths.candidates_dir(SOURCE_ID).iterdir() if p.is_dir()}
    assert on_disk == {p.parent.name for p in strict}


def test_list_candidates_filters_across_sources(data_root):
    _install(_fixture())
    _install({**_fixture(), "sourceId": "src_other", "map": "de_inferno", "demoSha256": "b" * 64}, "src_other")
    mine_source(SOURCE_ID)
    mine_source("src_other")
    everything = list_candidates()
    assert {row["sourceId"] for row in everything} == {SOURCE_ID, "src_other"}
    assert [r["score"] for r in everything] == sorted((r["score"] for r in everything), reverse=True)
    assert {r["sourceId"] for r in list_candidates(map_name="de_inferno")} == {"src_other"}
    assert {r["sourceId"] for r in list_candidates(source_ids=[SOURCE_ID])} == {SOURCE_ID}
    assert {r["category"] for r in list_candidates(category="post_plant")} == {"post_plant"}
    assert all(r["score"] >= 0.85 for r in list_candidates(min_score=0.85))


def test_ground_truth_is_separate_from_player_known(data_root):
    round_ = s.make_round(
        1, duration=90.0, positions={"p03": SECRET},
        events=[s.plant_event(45.0), s.kill(55.0, "p02", "p07"), s.event(85.0, "bomb_exploded", player=None, site="A", place="BombsiteA", x=1000, y=1000)],
    )
    match = s.make_match([round_])
    candidates = mine_match(match)
    ct = next(c for c in candidates if c["perspective"] == "CT" and c["category"] == "post_plant")
    truth = ct["groundTruth"]
    assert set(truth) >= {"enemies", "bomb", "timelineBefore", "timelineAfter", "outcome"}
    assert any(e["pid"] == "p03" and e["place"] == "Zzyzx" for e in truth["enemies"])  # the reviewer sees him ...
    for part in (ct["playerKnown"], ct["followUp"], ct["summary"]):
        assert "Zzyzx" not in json.dumps(part)  # ... the brief never does
    assert set(truth["outcome"]) >= {"winner", "endReason", "bombOutcome", "ownSurvivors", "enemySurvivors"}
    assert truth["outcome"]["winner"] == "T" and truth["outcome"]["bombOutcome"] == "exploded"
    assert truth["bomb"]["status"] == "planted"
    assert all(e["tick"] <= ct["decisionTick"] for e in truth["timelineBefore"])
    assert all(e["tick"] > ct["decisionTick"] for e in truth["timelineAfter"])
    assert any("planted" in e["description"] for e in truth["timelineBefore"])
    assert ct["actualLine"].startswith("HISTORICAL LINE")
    assert "not assumed to be the correct line" in ct["actualLine"]
    assert any("historical line is not assumed" in note.lower() for note in ct["reviewNotes"])
    assert any("comms" in note.lower() for note in ct["reviewNotes"])
    # no player names anywhere: the fixture has none, and descriptions use pids only
    assert all("p0" in e["description"] or "bomb" in e["description"] for e in truth["timelineAfter"])
    # the actual line describes players only in aggregate, never by pid
    assert not any(pid in ct["actualLine"] for pid in s.T_PIDS + s.CT_PIDS)
    assert not any(pid in ct["summary"] for pid in s.T_PIDS + s.CT_PIDS)


def test_mine_source_fails_clearly_without_a_parsed_match(data_root):
    with pytest.raises(FileNotFoundError):
        mine_source("src_missing")
