"""A demo the editor already has on disk (downloaded by hand, from a test corpus, ...)."""

from __future__ import annotations

import shutil
from datetime import date
from importlib import metadata
from pathlib import Path
from typing import Any

from .. import paths
from ..model import (
    NORMALISER_VERSION,
    Acquisition,
    ContentLane,
    DemoInfo,
    MatchInfo,
    ParserInfo,
    SourceManifest,
    sha256_file,
)
from . import manifest as manifest_mod
from .base import AcquiredDemo, SourceError

DEFAULT_LICENCE = "unspecified (user-supplied file)"
DEFAULT_NOTE = "Hand-supplied demo file; rights in the underlying match recording are not established."


def parser_info() -> ParserInfo:
    try:
        version = metadata.version("demoparser2")
    except metadata.PackageNotFoundError:  # pragma: no cover - dependency is pinned
        version = "unknown"
    return {"name": "demoparser2", "version": version, "normaliserVersion": NORMALISER_VERSION}


class LocalFileSource:
    """DemoSource for a file the user supplies. `reference` is the file path."""

    name = "local"

    def __init__(
        self,
        *,
        licence: str = DEFAULT_LICENCE,
        content_lane: ContentLane = "synthetic_only",
        provenance_note: str = DEFAULT_NOTE,
        competition: str | None = None,
        match_date: str | None = None,
    ) -> None:
        self._licence = licence
        self._lane = content_lane
        self._note = provenance_note
        self._competition = competition
        self._date = match_date

    def acquire(self, reference: str, destination: Path) -> AcquiredDemo:
        source = Path(reference).expanduser()
        if not source.is_file():
            raise SourceError(f"demo file not found: {source}")
        target = destination if destination.suffix == ".dem" else destination / source.name
        target.parent.mkdir(parents=True, exist_ok=True)
        if not (target.exists() and target.resolve() == source.resolve()):
            shutil.copyfile(source, target)
        acquisition: Acquisition = {
            "method": "local_file",
            "url": None,
            "retrievedAt": date.today().isoformat(),
            "notes": f"Supplied as a local file named {source.name}.",
        }
        match: MatchInfo = {"competition": self._competition, "date": self._date, "teams": None}
        return AcquiredDemo(
            path=target,
            acquisition=acquisition,
            match=match,
            licence=self._licence,
            content_lane=self._lane,
            provenance_note=self._note,
        )


def add_local_demo(
    path: Path,
    *,
    source_id: str,
    acquisition: dict[str, Any],
    match: dict[str, Any],
    licence: str,
    content_lane: str,
    provenance_note: str,
) -> SourceManifest:
    """Copy a demo into data-local/demos/<source_id>.dem and write its manifest.

    Idempotent for identical bytes. A different demo under an existing id is refused.
    """
    from ..parse.demo_info import read_demo_info  # local import: keeps manifest tooling light

    manifest_mod.validate_source_id(source_id)
    path = Path(path).expanduser()
    if not path.is_file():
        raise SourceError(f"demo file not found: {path}")

    digest = sha256_file(path)
    demos = paths.demos_dir()
    demos.mkdir(parents=True, exist_ok=True)
    destination = demos / f"{source_id}.dem"

    # Refuse before copying anything if the id is already bound to a different demo.
    existing_manifest = manifest_mod.manifest_path(source_id)
    if existing_manifest.exists():
        existing = manifest_mod.read_manifest(source_id)
        if existing["demo"]["sha256"] != digest:
            raise manifest_mod.ManifestError(
                f"{source_id} is already registered for a different demo; use a new source id"
            )
    if destination.exists() and sha256_file(destination) != digest:
        raise SourceError(f"{destination} exists with different content; use a new source id")
    if not destination.exists():
        partial = destination.with_suffix(".dem.partial")
        shutil.copyfile(path, partial)
        partial.replace(destination)

    facts = read_demo_info(destination)
    demo: DemoInfo = {
        "sha256": digest,
        "bytes": destination.stat().st_size,
        "localFilename": destination.name,
        "mapName": str(facts["mapName"]),
        "patchVersion": facts["patchVersion"],  # type: ignore[typeddict-item]
        "tickrate": int(facts["tickrate"]),  # type: ignore[call-overload]
    }
    manifest = manifest_mod.build_manifest(
        source_id=source_id,
        acquisition=acquisition,  # type: ignore[arg-type]
        demo=demo,
        match=match,  # type: ignore[arg-type]
        licence=licence,
        content_lane=content_lane,
        provenance_note=provenance_note,
        parser=parser_info(),
    )
    manifest_mod.write_manifest(manifest)
    return manifest
