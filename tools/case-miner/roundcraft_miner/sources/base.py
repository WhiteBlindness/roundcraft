"""Source adapter boundary.

Every source (a hand-supplied file, FACEIT, a tournament organiser release,
some future sanctioned API) does exactly one job: put a demo file on disk and
describe where it came from. Nothing downstream of `acquire()` knows or cares
which adapter produced the demo.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from ..model import Acquisition, ContentLane, MatchInfo


class SourceError(RuntimeError):
    """Raised when a source cannot supply a demo (missing credentials, no demo, terms)."""


@dataclass(frozen=True)
class AcquiredDemo:
    """What an adapter hands to `roundcraft-miner source add`."""

    path: Path  # demo file on local disk (may be a temporary download)
    acquisition: Acquisition
    match: MatchInfo
    licence: str
    content_lane: ContentLane
    provenance_note: str


class DemoSource(Protocol):
    name: str

    def acquire(self, reference: str, destination: Path) -> AcquiredDemo:
        """Fetch or locate the demo identified by `reference` into `destination`.

        Adapters must respect the source's terms: no scraping, no bypassing
        authentication, rate limits or download restrictions. Credentials come
        from environment variables only and are never written to disk.
        """
        ...
