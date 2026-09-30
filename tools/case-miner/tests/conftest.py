"""Shared pytest fixtures.

NOTE: `isolated_roots` was reconstructed from its usages (tests/test_sources_local.py,
tests/test_parse_normalise.py) after this file was overwritten during parallel work; the owner of
those tests should re-check it. The draft tests keep their fixtures in tests/draft_support.py.
"""

from __future__ import annotations

import pytest


@pytest.fixture
def isolated_roots(tmp_path, monkeypatch):
    """Point the data root and the manifests directory at scratch space; returns (data_root, manifests_dir)."""
    data = tmp_path / "data-local"
    manifests = tmp_path / "manifests"
    monkeypatch.setenv("ROUNDCRAFT_DATA", str(data))
    monkeypatch.setenv("ROUNDCRAFT_MANIFESTS", str(manifests))
    return data, manifests
