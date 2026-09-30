"""draft_case: file handling, review.md, and a REAL run of the repository's content validator.

The validator is invoked through the same entry point as `npm run content:validate`, pointed at a
temporary <root>/content/cases directory, so nothing is ever written into the repository's content/.
"""

from __future__ import annotations

import json
import shutil

import pytest

from draft_support import candidate_dir, temp_repo  # noqa: F401
from roundcraft_miner import paths
from roundcraft_miner.draft.case_draft import DraftRefused, build_case, draft_case
from roundcraft_miner.draft.validate_run import parse_validator_output

needs_node = pytest.mark.skipif(shutil.which("node") is None or shutil.which("npm") is None, reason="Node/npm not available")


def test_parse_validator_output():
    out = (
        "DRAFT content/cases/x.json  status=draft  errors=1  warnings=1  publishable=no\n"
        "      error [main_incomplete] rubric.main is missing cells: a/b\n"
        "      warn  [followup_flat] flat\n\n1 case file(s): 0 failing, 1 draft(s) with readiness errors, 0 publishable.\n"
    )
    parsed = parse_validator_output(out)
    assert parsed["state"] == "DRAFT" and parsed["publishable"] is False
    assert parsed["errors"] == ["[main_incomplete] rubric.main is missing cells: a/b"]
    assert parsed["warnings"] == ["[followup_flat] flat"]


@needs_node
@pytest.mark.parametrize("name", ["candidate_retake_ct", "candidate_post_plant_t", "candidate_ct_hold_nofollowup", "candidate_ct_hold_two_alive"])
def test_generated_draft_passes_every_hard_validator_invariant(name, candidate_dir, temp_repo):
    candidate_path = candidate_dir(name)
    path, report = draft_case(candidate_path, out_dir=temp_repo)
    assert path.parent == temp_repo and path.name == f"{report['caseId']}.json"
    assert report["validated"] is True
    assert report["validatorExitCode"] == 0
    assert report["errors"] == [], report["errors"]
    assert report["state"] == "PASS"
    assert report["publishable"] is False  # a draft can never be publishable: human review is still required
    written = json.loads(path.read_text(encoding="utf-8"))
    assert written["editorial"]["status"] == "draft"
    assert written == build_case(json.loads(candidate_path.read_text(encoding="utf-8")))


@needs_node
def test_validator_really_runs_and_reports_broken_drafts(candidate_dir, temp_repo):
    """Prove the integration is not a rubber stamp: break a written draft and re-validate it."""
    from roundcraft_miner.draft.validate_run import run_validator

    candidate_path = candidate_dir("candidate_retake_ct")
    path, _ = draft_case(candidate_path, out_dir=temp_repo)
    case = json.loads(path.read_text(encoding="utf-8"))
    case["rubric"]["main"].pop()  # remove one action x qualifier cell
    case["reveal"]["comparison"]["roundAction"] = " ".join(case["brief"]["facts"][1]["text"].split() * 2)
    path.write_text(json.dumps(case, ensure_ascii=False), encoding="utf-8")
    report = run_validator(case["caseId"], path)
    codes = " ".join(report["errors"])
    assert "[main_incomplete]" in codes
    assert "[disclosure_overlap]" in codes
    assert report["validatorExitCode"] == 0  # drafts report readiness errors without failing the run


def test_refuses_overwrite_and_non_drafts(candidate_dir, temp_repo):
    candidate_path = candidate_dir("candidate_retake_ct")
    path, _ = draft_case(candidate_path, out_dir=temp_repo, validate=False)
    with pytest.raises(DraftRefused):
        draft_case(candidate_path, out_dir=temp_repo, validate=False)
    again, _ = draft_case(candidate_path, out_dir=temp_repo, validate=False, overwrite=True)
    assert again == path
    case = json.loads(path.read_text(encoding="utf-8"))
    case["editorial"]["status"] = "technically_validated"
    path.write_text(json.dumps(case), encoding="utf-8")
    before = path.read_text(encoding="utf-8")
    with pytest.raises(DraftRefused):
        draft_case(candidate_path, out_dir=temp_repo, validate=False, overwrite=True)
    assert path.read_text(encoding="utf-8") == before


def test_review_markdown_is_written_next_to_the_candidate(candidate_dir, temp_repo):
    candidate_path = candidate_dir("candidate_retake_ct")
    (candidate_path.parent / "player-known.svg").write_text("<svg/>", encoding="utf-8")
    draft_case(candidate_path, out_dir=temp_repo, validate=False)
    review = (candidate_path.parent / "review.md").read_text(encoding="utf-8")
    for heading in ("## Candidate", "## Score factors", "## Player-known facts", "## Follow-up", "## What happened in the source round",
                    "## Disputed assumptions", "## Alternative plausible lines", "## Validation", "## Renders"):
        assert heading in review
    assert "[player-known.svg](player-known.svg)" in review and "ground-truth.svg" not in review.replace("(run", "")
    assert "validator not run" in review
    assert "NOT the answer" in review


@needs_node
def test_review_markdown_includes_validation_results(candidate_dir, temp_repo):
    candidate_path = candidate_dir("candidate_post_plant_t")
    _, report = draft_case(candidate_path, out_dir=temp_repo)
    review = (candidate_path.parent / "review.md").read_text(encoding="utf-8")
    assert "exit code 0" in review and f"state {report['state']}" in review


def test_default_output_directory_is_the_repo_cases_dir():
    assert paths.cases_dir().name == "cases" and paths.cases_dir().parent.name == "content"


def _real_candidates():
    root = paths.data_root() / "candidates"
    return sorted(root.glob("*/cand_*/candidate.json")) if root.exists() else []


@needs_node
@pytest.mark.skipif(not _real_candidates(), reason="no mined candidates under data-local/candidates")
def test_real_candidates_of_every_category_pass_hard_invariants(tmp_path, temp_repo):
    """One real candidate per (category, perspective) goes through the real validator."""
    chosen: dict[tuple[str, str], object] = {}
    for path in _real_candidates():
        data = json.loads(path.read_text(encoding="utf-8"))
        chosen.setdefault((data["category"], data["perspective"]), path)
    assert chosen
    for index, path in enumerate(chosen.values()):
        scratch = tmp_path / f"c{index}"
        scratch.mkdir()
        copy = scratch / "candidate.json"
        shutil.copy(path, copy)  # review.md must not be written into data-local during tests
        _, report = draft_case(copy, out_dir=temp_repo)
        assert report["validatorExitCode"] == 0, (path.parent.name, report)
        assert report["errors"] == [], (path.parent.name, report["errors"])
