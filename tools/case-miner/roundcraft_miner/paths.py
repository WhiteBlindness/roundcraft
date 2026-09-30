"""Filesystem layout. Raw and derived data stay in the git-ignored data-local/ tree."""

from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]


def data_root() -> Path:
    return Path(os.environ.get("ROUNDCRAFT_DATA", REPO_ROOT / "data-local"))


def demos_dir() -> Path:
    return data_root() / "demos"


def parsed_dir(source_id: str) -> Path:
    return data_root() / "parsed" / source_id


def candidates_dir(source_id: str) -> Path:
    return data_root() / "candidates" / source_id


def manifests_dir() -> Path:
    """Committed provenance manifests, one small JSON file per source demo."""
    return Path(os.environ.get("ROUNDCRAFT_MANIFESTS", REPO_ROOT / "content" / "sources"))


def cases_dir() -> Path:
    return Path(os.environ.get("ROUNDCRAFT_CASES", REPO_ROOT / "content" / "cases"))
