"""Shared fixtures for the draft tests (kept out of conftest.py so other test modules are unaffected)."""

from __future__ import annotations

import copy
import json
import shutil
from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures"
FIXTURE_NAMES = ("candidate_retake_ct", "candidate_post_plant_t", "candidate_ct_hold_nofollowup")


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))


@pytest.fixture(params=FIXTURE_NAMES)
def candidate(request) -> dict:
    return load_fixture(request.param)


@pytest.fixture
def retake() -> dict:
    return load_fixture("candidate_retake_ct")


@pytest.fixture
def clone():
    return copy.deepcopy


@pytest.fixture
def temp_repo(tmp_path: Path) -> Path:
    """<tmp>/content/cases: the shape the validator expects, so the real repo is never touched."""
    cases = tmp_path / "content" / "cases"
    cases.mkdir(parents=True)
    return cases


@pytest.fixture
def candidate_dir(tmp_path: Path):
    """Copy a fixture into a scratch directory so review.md lands there, not in tests/fixtures."""

    def make(name: str) -> Path:
        folder = tmp_path / "candidates" / name
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / "candidate.json"
        shutil.copy(FIXTURES / f"{name}.json", target)
        return target

    return make
