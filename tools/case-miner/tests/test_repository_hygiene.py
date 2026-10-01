"""Guards that keep raw match data and identities out of the public repository."""

from __future__ import annotations

import json
import re
import subprocess

from roundcraft_miner import paths

RAW_DEMO = re.compile(r"\.dem(\.(gz|bz2|zst))?$|(^|/)data-local/", re.IGNORECASE)
STEAM_ID = re.compile(r"\b7656119\d{10}\b")


def _tracked_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files"], cwd=paths.REPO_ROOT, check=True, capture_output=True, text=True
    )
    return result.stdout.splitlines()


def test_no_raw_demo_or_local_data_is_tracked() -> None:
    offenders = [name for name in _tracked_files() if RAW_DEMO.search(name)]
    assert offenders == []


def test_raw_demo_paths_are_ignored() -> None:
    result = subprocess.run(
        ["git", "check-ignore", "data-local/demos/x.dem", "somewhere/match.dem", "data-local/parsed/x/match.json"],
        cwd=paths.REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert len(result.stdout.splitlines()) == 3


def test_committed_manifests_and_cases_carry_no_steam_ids() -> None:
    committed = [
        paths.REPO_ROOT / name
        for name in _tracked_files()
        if name.startswith(("content/sources/", "content/cases/")) and name.endswith(".json")
    ]
    for path in committed:
        assert not STEAM_ID.search(path.read_text(encoding="utf-8")), path


def test_every_manifest_declares_provenance_and_lane() -> None:
    for path in sorted(paths.manifests_dir().glob("src_*.json")):
        manifest = json.loads(path.read_text(encoding="utf-8"))
        assert manifest["rights"]["contentLane"] in {"synthetic_only", "professional_allowed"}
        assert manifest["rights"]["provenanceNote"].strip()
        assert re.fullmatch(r"[0-9a-f]{64}", manifest["demo"]["sha256"])


def test_mined_drafts_stay_drafts_and_synthetic() -> None:
    for path in sorted(paths.cases_dir().glob("*.json")):
        case = json.loads(path.read_text(encoding="utf-8"))
        references = case.get("editorial", {}).get("references", [])
        if any("candidateId" in str(ref.get("detail", "")) or "cand_" in str(ref) for ref in references):
            assert case["editorial"]["status"] == "draft", path
            assert case["origin"] == "synthetic", path


REVIEW_DIR = paths.REPO_ROOT / "content" / "review"
PID = re.compile(r"\bp\d{2} \((T|CT)\)|\bp\d{2} (killed|planted|began|detonated|threw)")
MODEL_NAMES = re.compile(r"\b(claude|opus|sonnet|haiku|fable|gpt|gemini)\b", re.IGNORECASE)


def test_review_packets_carry_no_identities() -> None:
    for path in sorted(REVIEW_DIR.glob("*/*")):
        text = path.read_text(encoding="utf-8")
        assert not STEAM_ID.search(text), path
        assert not PID.search(text), path


def test_review_questions_point_at_real_drafts() -> None:
    questions_file = REVIEW_DIR / "questions.json"
    if not questions_file.exists():
        return
    questions = json.loads(questions_file.read_text(encoding="utf-8"))
    for case_id, entry in questions.items():
        assert (paths.cases_dir() / f"{case_id}.json").exists(), case_id
        assert entry["recommendation"] in {"KEEP", "REVIEW FIRST", "NEEDS TACTICAL DECISION", "DROP"}, case_id
        assert entry["questions"], case_id


def test_no_model_is_ever_recorded_as_a_reviewer() -> None:
    for path in sorted(paths.cases_dir().glob("*.json")):
        editorial = json.loads(path.read_text(encoding="utf-8")).get("editorial", {})
        for reviewer in editorial.get("reviewers", []):
            assert not MODEL_NAMES.search(str(reviewer.get("name", ""))), path
