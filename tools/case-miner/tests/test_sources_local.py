"""Manifest validation and local-file source tests."""

from __future__ import annotations

import copy
import hashlib
from pathlib import Path

import pytest

from roundcraft_miner import paths
from roundcraft_miner.model import read_json, sha256_file
from roundcraft_miner.sources import manifest as mf
from roundcraft_miner.sources.base import SourceError
from roundcraft_miner.sources.local import LocalFileSource, add_local_demo

SHA_A = "a" * 64
SHA_B = "b" * 64


def make_manifest(source_id="src_test_one", sha=SHA_A, **rights):
    return mf.build_manifest(
        source_id=source_id,
        acquisition={"method": "local_file", "url": None, "retrievedAt": "2026-09-30", "notes": "n"},
        demo={
            "sha256": sha, "bytes": 10, "localFilename": f"{source_id}.dem", "mapName": "de_mirage",
            "patchVersion": "1", "tickrate": 64,
        },
        match={"competition": None, "date": None, "teams": None},
        licence=rights.get("licence", "MIT (test)"),
        content_lane=rights.get("content_lane", "synthetic_only"),
        provenance_note=rights.get("note", "Rights not established."),
        parser={"name": "demoparser2", "version": "0.42.0", "normaliserVersion": 1},
    )


@pytest.mark.parametrize("bad", ["", "mirage", "src_", "src_UPPER", "src_has-dash", "src_a b", "SRC_x", "xsrc_a", "src_a\n"])
def test_bad_source_ids_rejected(bad):
    with pytest.raises(mf.ManifestError):
        mf.validate_source_id(bad)
    with pytest.raises(mf.ManifestError):
        make_manifest(source_id=bad)


def test_good_source_ids_accepted():
    for good in ("src_a", "src_mirage_mm_demoparser_test", "src_inferno_cs2_test_20230901", "src_9"):
        assert mf.validate_source_id(good) == good


def test_content_lane_enum_enforced():
    make_manifest(content_lane="professional_allowed")
    with pytest.raises(mf.ManifestError, match="contentLane"):
        make_manifest(content_lane="anything_goes")


@pytest.mark.parametrize("field", ["licence", "note"])
def test_required_provenance_text_must_be_non_empty(field):
    with pytest.raises(mf.ManifestError):
        make_manifest(**{field: "   "})


def test_sha256_must_be_lowercase_hex():
    for bad in ("", "abc", "G" * 64, "A" * 64, "a" * 63):
        manifest = copy.deepcopy(make_manifest())
        manifest["demo"]["sha256"] = bad
        with pytest.raises(mf.ManifestError, match="sha256"):
            mf.validate_manifest(manifest)


def test_validation_rejects_structural_problems():
    base = make_manifest()
    for mutate in (
        lambda m: m["acquisition"].update(method="carrier_pigeon"),
        lambda m: m["acquisition"].update(retrievedAt="yesterday"),
        lambda m: m["demo"].update(localFilename="../escape.dem"),
        lambda m: m["demo"].update(tickrate=0),
        lambda m: m["demo"].update(mapName=""),
        lambda m: m.update(schemaVersion=99),
        lambda m: m["match"].update(teams="not a list"),
    ):
        broken = copy.deepcopy(base)
        mutate(broken)
        with pytest.raises(mf.ManifestError):
            mf.validate_manifest(broken)


def test_write_manifest_roundtrip_and_overwrite_rules(isolated_roots):
    _data, manifests = isolated_roots
    manifest = make_manifest()
    path = mf.write_manifest(manifest)
    assert path == manifests / "src_test_one.json"
    assert mf.read_manifest("src_test_one") == manifest
    # same demo again: allowed (idempotent, provenance text may be refined)
    refined = make_manifest(note="Refined note.")
    mf.write_manifest(refined)
    assert mf.read_manifest("src_test_one")["rights"]["provenanceNote"] == "Refined note."
    # different demo under the same id: refused, file unchanged
    with pytest.raises(mf.ManifestError, match="different demo"):
        mf.write_manifest(make_manifest(sha=SHA_B))
    assert mf.read_manifest("src_test_one")["demo"]["sha256"] == SHA_A


def test_add_local_demo_refuses_different_bytes_under_existing_id(isolated_roots, tmp_path):
    mf.write_manifest(make_manifest(source_id="src_taken"))
    impostor = tmp_path / "other.dem"
    impostor.write_bytes(b"not the same demo")
    with pytest.raises(mf.ManifestError, match="different demo"):
        add_local_demo(
            impostor, source_id="src_taken",
            acquisition={"method": "local_file", "url": None, "retrievedAt": "2026-09-30", "notes": ""},
            match={"competition": None, "date": None, "teams": None},
            licence="x", content_lane="synthetic_only", provenance_note="y",
        )
    assert not (paths.demos_dir() / "src_taken.dem").exists()  # nothing was copied


def test_add_local_demo_missing_file(isolated_roots, tmp_path):
    with pytest.raises(SourceError):
        add_local_demo(
            tmp_path / "nope.dem", source_id="src_nope",
            acquisition={"method": "local_file", "url": None, "retrievedAt": "2026-09-30", "notes": ""},
            match={"competition": None, "date": None, "teams": None},
            licence="x", content_lane="synthetic_only", provenance_note="y",
        )


def test_local_file_source_acquire_copies_and_defaults_to_synthetic_only(tmp_path):
    src = tmp_path / "match.dem"
    src.write_bytes(b"demo bytes")
    acquired = LocalFileSource().acquire(str(src), tmp_path / "dest")
    assert acquired.path == tmp_path / "dest" / "match.dem"
    assert acquired.path.read_bytes() == b"demo bytes"
    assert acquired.acquisition["method"] == "local_file" and acquired.acquisition["url"] is None
    assert acquired.content_lane == "synthetic_only"
    assert "not established" in acquired.provenance_note
    with pytest.raises(SourceError):
        LocalFileSource().acquire(str(tmp_path / "missing.dem"), tmp_path / "dest")


REAL_DEMO = Path(paths.REPO_ROOT) / "data-local" / "demos" / "src_mirage_mm_demoparser_test.dem"


@pytest.mark.skipif(not REAL_DEMO.exists(), reason="local Mirage demo not present")
def test_add_local_demo_real_demo_is_idempotent(isolated_roots):
    kwargs = dict(
        source_id="src_mirage_copy",
        acquisition={"method": "public_test_corpus", "url": "https://example.invalid/x", "retrievedAt": "2026-09-30", "notes": "n"},
        match={"competition": "valve_matchmaking", "date": None, "teams": None},
        licence="MIT (public parser test corpus); rights in the underlying match recording not established",
        content_lane="synthetic_only",
        provenance_note="Rights in the underlying match are not established.",
    )
    first = add_local_demo(REAL_DEMO, **kwargs)
    copied = paths.demos_dir() / "src_mirage_copy.dem"
    assert copied.exists() and sha256_file(copied) == first["demo"]["sha256"]
    assert first["demo"]["mapName"] == "de_mirage"
    assert first["demo"]["tickrate"] == 64
    assert first["demo"]["patchVersion"] == "13984"
    assert first["parser"]["name"] == "demoparser2" and first["parser"]["normaliserVersion"] == 1
    mtime = copied.stat().st_mtime_ns
    second = add_local_demo(REAL_DEMO, **kwargs)
    assert second == first
    assert copied.stat().st_mtime_ns == mtime  # not copied again
    on_disk = read_json(mf.manifest_path("src_mirage_copy"))
    text = mf.manifest_path("src_mirage_copy").read_text()
    assert on_disk == first
    assert hashlib.sha256(copied.read_bytes()).hexdigest() == first["demo"]["sha256"]
    assert "7656119" not in text  # no Steam IDs in a manifest
