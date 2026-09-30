"""Build, validate and write source manifests (committed provenance records).

A manifest describes where a demo came from and what may be done with it. It
never contains player names or Steam IDs.
"""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path
from typing import Any, get_args

from .. import paths
from ..model import (
    SCHEMA_VERSION,
    Acquisition,
    ContentLane,
    DemoInfo,
    MatchInfo,
    ParserInfo,
    Rights,
    SourceManifest,
    read_json,
    write_json,
)

SOURCE_ID_PATTERN = re.compile(r"^src_[a-z0-9_]+$")
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
CONTENT_LANES: tuple[str, ...] = get_args(ContentLane)
ACQUISITION_METHODS = ("local_file", "faceit_data_api", "public_test_corpus", "organiser_release")


class ManifestError(ValueError):
    """A manifest is malformed, or writing it would clobber a different demo's record."""


def _require_text(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ManifestError(f"{label} must be a non-empty string")
    return value


def validate_source_id(source_id: str) -> str:
    if not isinstance(source_id, str) or not SOURCE_ID_PATTERN.fullmatch(source_id):
        raise ManifestError(f"sourceId {source_id!r} must match {SOURCE_ID_PATTERN.pattern}")
    return source_id


def validate_manifest(manifest: SourceManifest | dict[str, Any]) -> None:
    """Raise ManifestError describing the first problem found."""
    if not isinstance(manifest, dict):
        raise ManifestError("manifest must be an object")
    if manifest.get("schemaVersion") != SCHEMA_VERSION:
        raise ManifestError(f"schemaVersion must be {SCHEMA_VERSION}")
    validate_source_id(manifest.get("sourceId", ""))

    acquisition = manifest.get("acquisition")
    if not isinstance(acquisition, dict):
        raise ManifestError("acquisition is required")
    if acquisition.get("method") not in ACQUISITION_METHODS:
        raise ManifestError(f"acquisition.method must be one of {ACQUISITION_METHODS}")
    url = acquisition.get("url")
    if url is not None and not isinstance(url, str):
        raise ManifestError("acquisition.url must be a string or null")
    try:
        date.fromisoformat(str(acquisition.get("retrievedAt")))
    except ValueError as exc:
        raise ManifestError("acquisition.retrievedAt must be an ISO date (YYYY-MM-DD)") from exc
    if not isinstance(acquisition.get("notes"), str):
        raise ManifestError("acquisition.notes must be a string")

    demo = manifest.get("demo")
    if not isinstance(demo, dict):
        raise ManifestError("demo is required")
    if not isinstance(demo.get("sha256"), str) or not SHA256_PATTERN.fullmatch(demo["sha256"]):
        raise ManifestError("demo.sha256 must be 64 lowercase hex characters")
    if not isinstance(demo.get("bytes"), int) or isinstance(demo["bytes"], bool) or demo["bytes"] < 0:
        raise ManifestError("demo.bytes must be a non-negative integer")
    local = _require_text(demo.get("localFilename"), "demo.localFilename")
    if "/" in local or "\\" in local or local.startswith("."):
        raise ManifestError("demo.localFilename must be a bare file name relative to data-local/demos/")
    _require_text(demo.get("mapName"), "demo.mapName")
    patch = demo.get("patchVersion")
    if patch is not None and not isinstance(patch, str):
        raise ManifestError("demo.patchVersion must be a string or null")
    tickrate = demo.get("tickrate")
    if not isinstance(tickrate, int) or isinstance(tickrate, bool) or tickrate <= 0:
        raise ManifestError("demo.tickrate must be a positive integer")

    match = manifest.get("match")
    if not isinstance(match, dict):
        raise ManifestError("match is required")
    for key in ("competition", "date"):
        if match.get(key) is not None and not isinstance(match[key], str):
            raise ManifestError(f"match.{key} must be a string or null")
    teams = match.get("teams")
    if teams is not None and not (isinstance(teams, list) and all(isinstance(t, str) for t in teams)):
        raise ManifestError("match.teams must be a list of strings or null")

    rights = manifest.get("rights")
    if not isinstance(rights, dict):
        raise ManifestError("rights is required")
    _require_text(rights.get("licence"), "rights.licence")
    _require_text(rights.get("provenanceNote"), "rights.provenanceNote")
    if rights.get("contentLane") not in CONTENT_LANES:
        raise ManifestError(f"rights.contentLane must be one of {CONTENT_LANES}")

    parser = manifest.get("parser")
    if not isinstance(parser, dict):
        raise ManifestError("parser is required")
    _require_text(parser.get("name"), "parser.name")
    _require_text(parser.get("version"), "parser.version")
    if not isinstance(parser.get("normaliserVersion"), int):
        raise ManifestError("parser.normaliserVersion must be an integer")


def build_manifest(
    *,
    source_id: str,
    acquisition: Acquisition,
    demo: DemoInfo,
    match: MatchInfo,
    licence: str,
    content_lane: str,
    provenance_note: str,
    parser: ParserInfo,
) -> SourceManifest:
    manifest: SourceManifest = {
        "schemaVersion": SCHEMA_VERSION,
        "sourceId": source_id,
        "acquisition": acquisition,
        "demo": demo,
        "match": match,
        "rights": Rights(licence=licence, contentLane=content_lane, provenanceNote=provenance_note),  # type: ignore[typeddict-item]
        "parser": parser,
    }
    validate_manifest(manifest)
    return manifest


def manifest_path(source_id: str) -> Path:
    validate_source_id(source_id)
    return paths.manifests_dir() / f"{source_id}.json"


def read_manifest(source_id: str) -> SourceManifest:
    path = manifest_path(source_id)
    if not path.exists():
        raise ManifestError(f"no manifest for {source_id} at {path}")
    manifest = read_json(path)
    validate_manifest(manifest)
    return manifest


def write_manifest(manifest: SourceManifest) -> Path:
    """Validate and write the manifest. Refuses to replace a manifest for a different demo."""
    validate_manifest(manifest)
    path = manifest_path(manifest["sourceId"])
    if path.exists():
        existing = read_json(path)
        existing_sha = (existing.get("demo") or {}).get("sha256")
        if existing_sha != manifest["demo"]["sha256"]:
            raise ManifestError(
                f"{path.name} already exists for a different demo (sha256 {existing_sha}); "
                "choose a new source id instead of overwriting it"
            )
    write_json(path, manifest)
    return path
