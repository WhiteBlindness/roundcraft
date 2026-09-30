"""FACEIT adapter: match metadata from the Data API, demo files via the Downloads API.

What the official documentation says (see docs/content-sources.md for citations):

* The Data API (https://open.faceit.com/data/v4) works with an ordinary
  server-side API key created in the FACEIT Developer portal. Match details
  include `demo_url`, but that value is a *private resource URL*: it cannot be
  fetched directly.
* Demo files are only served through the separate Downloads API, which needs an
  approved application and its own access token, and which exchanges the
  resource URL for a short-lived signed download URL.

This adapter therefore never tries to fetch a `demo_url` directly. Without
Downloads API access it raises `SourceError` with the manual setup steps.
Credentials come from environment variables only and are never written to disk.

Environment variables:

    FACEIT_API_KEY              Data API server-side key (required)
    FACEIT_DOWNLOADS_TOKEN      access token with the Downloads API scope (optional)
    FACEIT_DOWNLOADS_ENDPOINT   Downloads API endpoint URL, copied from the
                                documentation FACEIT sends after approval (optional)
"""

from __future__ import annotations

import gzip
import json
import os
import re
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..model import Acquisition, MatchInfo
from .base import AcquiredDemo, SourceError

BASE_URL = "https://open.faceit.com/data/v4"
USER_AGENT = "roundcraft-case-miner/0.1 (offline editorial tooling)"
API_KEY_ENV = "FACEIT_API_KEY"
DOWNLOADS_TOKEN_ENV = "FACEIT_DOWNLOADS_TOKEN"
DOWNLOADS_ENDPOINT_ENV = "FACEIT_DOWNLOADS_ENDPOINT"

# Conservative pacing. FACEIT's published Data API limit was not verified from
# the official page; a request every half second is far below any plausible cap.
MIN_INTERVAL_SECONDS = 0.5
TIMEOUT_SECONDS = 30
CHUNK_BYTES = 1 << 20

_MATCH_ID_RE = re.compile(r"[0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")

DOWNLOADS_SETUP_MESSAGE = (
    "FACEIT demo files are private: the `demo_url` in match details cannot be downloaded "
    "directly and must be exchanged for a signed URL through the FACEIT Downloads API, "
    "which needs an approved application.\n"
    "Manual setup:\n"
    "  1. Apply for Downloads API access with the form linked from "
    "https://docs.faceit.com/getting-started/Guides/download-api/ "
    "(FACEIT documents a response time of about 30 days).\n"
    f"  2. After approval, export the access token as {DOWNLOADS_TOKEN_ENV} and the "
    f"endpoint URL from FACEIT's documentation as {DOWNLOADS_ENDPOINT_ENV}.\n"
    "  3. Re-run this command. Signed URLs are short-lived; the tool downloads immediately.\n"
    "Until then, download the demo yourself from the match room (your own or a public match) "
    "and add it as a local file instead."
)


class _Pacer:
    """Guarantees a minimum spacing between requests."""

    def __init__(self, min_interval: float) -> None:
        self.min_interval = min_interval
        self._last: float | None = None

    def wait(self) -> None:
        now = time.monotonic()
        if self._last is not None:
            remaining = self.min_interval - (now - self._last)
            if remaining > 0:
                time.sleep(remaining)
                now = time.monotonic()
        self._last = now


def extract_match_id(reference: str) -> str:
    """Accept a bare match id or a match-room URL; reject anything else."""
    found = _MATCH_ID_RE.search(reference.strip())
    if not found:
        raise SourceError(
            f"'{reference}' is not a FACEIT match id (expected e.g. 1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)."
        )
    return found.group(0)


class FaceitDataClient:
    """Minimal Data API client (standard library only)."""

    def __init__(self, api_key: str | None = None, min_interval: float = MIN_INTERVAL_SECONDS) -> None:
        self._api_key = api_key if api_key is not None else os.environ.get(API_KEY_ENV, "")
        self._pacer = _Pacer(min_interval)

    def _require_key(self) -> str:
        if not self._api_key:
            raise SourceError(
                f"{API_KEY_ENV} is not set. Create a server-side API key in the FACEIT Developer portal "
                f"(https://developers.faceit.com, App Studio, your app, API keys) and export it as {API_KEY_ENV}. "
                "The key is read from the environment only and never stored."
            )
        return self._api_key

    def get_match(self, match_id: str) -> dict[str, Any]:
        key = self._require_key()
        match_id = extract_match_id(match_id)
        url = f"{BASE_URL}/matches/{urllib.parse.quote(match_id, safe='')}"
        request = urllib.request.Request(
            url,
            headers={"Authorization": f"Bearer {key}", "Accept": "application/json", "User-Agent": USER_AGENT},
        )
        self._pacer.wait()
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            if error.code in (401, 403):
                raise SourceError(f"FACEIT rejected the API key (HTTP {error.code}). Check {API_KEY_ENV}.") from error
            if error.code == 404:
                raise SourceError(f"FACEIT match {match_id} was not found.") from error
            if error.code == 429:
                raise SourceError("FACEIT rate limit reached (HTTP 429). Wait and retry later.") from error
            raise SourceError(f"FACEIT Data API error: HTTP {error.code}.") from error
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            raise SourceError(f"FACEIT Data API request failed: {error}") from error
        if not isinstance(payload, dict):
            raise SourceError("FACEIT Data API returned an unexpected payload.")
        return payload


def _iso_date(value: Any) -> str | None:
    if isinstance(value, (int, float)) and value > 0:
        return datetime.fromtimestamp(value, tz=timezone.utc).date().isoformat()
    return None


def match_info_from_metadata(metadata: dict[str, Any]) -> MatchInfo:
    """Map FACEIT match metadata to MatchInfo. Never copies team or player names."""
    competition = metadata.get("competition_name")
    date = _iso_date(metadata.get("finished_at")) or _iso_date(metadata.get("started_at"))
    return {
        "competition": str(competition) if competition else "faceit",
        "date": date,
        "teams": None,
    }


def map_name_from_metadata(metadata: dict[str, Any]) -> str | None:
    picks = (((metadata.get("voting") or {}).get("map") or {}).get("pick")) or []
    return str(picks[0]) if picks else None


def _demo_urls(metadata: dict[str, Any]) -> list[str]:
    raw = metadata.get("demo_url")
    if isinstance(raw, str):
        raw = [raw]
    return [u for u in (raw or []) if isinstance(u, str) and u.startswith("https://")]


def _compression_of(resource_url: str) -> str | None:
    path = urllib.parse.urlparse(resource_url).path.lower()
    if path.endswith(".gz"):
        return "gz"
    if path.endswith(".zst"):
        return "zst"
    return None


def decompress(source: Path, target: Path, kind: str | None) -> Path:
    """Write the plain .dem to `target`. gz uses the standard library; zst only where it ships one."""
    if kind is None:
        source.replace(target)
        return target
    if kind == "gz":
        with gzip.open(source, "rb") as src, target.open("wb") as dst:
            shutil.copyfileobj(src, dst, CHUNK_BYTES)
        source.unlink(missing_ok=True)
        return target
    if kind == "zst":
        try:
            from compression import zstd  # type: ignore[import-not-found]  # Python 3.14+
        except ImportError as error:
            raise SourceError(
                "This demo is zstd-compressed (.dem.zst) and Python's standard library has no zstd "
                "decoder before 3.14. Decompress it once by hand (`zstd -d file.dem.zst`) and add the "
                "resulting .dem as a local file."
            ) from error
        with zstd.open(source, "rb") as src, target.open("wb") as dst:
            shutil.copyfileobj(src, dst, CHUNK_BYTES)
        source.unlink(missing_ok=True)
        return target
    raise SourceError(f"Unsupported demo compression: {kind}")


class FaceitSource:
    name = "faceit"

    def __init__(self, client: FaceitDataClient | None = None) -> None:
        self._client = client or FaceitDataClient()

    # -- Downloads API -----------------------------------------------------

    def _signed_url(self, resource_url: str) -> str:
        token = os.environ.get(DOWNLOADS_TOKEN_ENV, "")
        endpoint = os.environ.get(DOWNLOADS_ENDPOINT_ENV, "")
        if not token or not endpoint:
            raise SourceError(DOWNLOADS_SETUP_MESSAGE)
        if not endpoint.startswith("https://"):
            raise SourceError(f"{DOWNLOADS_ENDPOINT_ENV} must be an https URL.")
        request = urllib.request.Request(
            endpoint,
            data=json.dumps({"resource_url": resource_url}).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": USER_AGENT,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            if error.code in (401, 403):
                raise SourceError(
                    f"The Downloads API rejected the token (HTTP {error.code}). "
                    "Check that access was approved and the token has the Downloads API scope."
                ) from error
            raise SourceError(f"FACEIT Downloads API error: HTTP {error.code}.") from error
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            raise SourceError(f"FACEIT Downloads API request failed: {error}") from error
        signed = ((payload or {}).get("payload") or {}).get("download_url") or (payload or {}).get("download_url")
        if not isinstance(signed, str) or not signed.startswith("https://"):
            raise SourceError("The Downloads API response did not contain a download_url.")
        return signed

    def _stream(self, url: str, target: Path) -> None:
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response, target.open("wb") as out:
                shutil.copyfileobj(response, out, CHUNK_BYTES)
        except (urllib.error.URLError, TimeoutError) as error:
            target.unlink(missing_ok=True)
            raise SourceError(f"Demo download failed: {error}") from error

    # -- DemoSource --------------------------------------------------------

    def acquire(self, reference: str, destination: Path) -> AcquiredDemo:
        match_id = extract_match_id(reference)
        metadata = self._client.get_match(match_id)
        urls = _demo_urls(metadata)
        if not urls:
            raise SourceError(f"FACEIT match {match_id} has no demo_url (demo not available or match unfinished).")
        if len(urls) > 1:
            # Multi-map series: keep the tool deterministic and explicit.
            raise SourceError(
                f"FACEIT match {match_id} lists {len(urls)} demo files; acquire one match room per map."
            )
        resource_url = urls[0]
        signed_url = self._signed_url(resource_url)  # raises the documented setup message when not configured

        if destination.suffix == ".dem":
            final = destination
        else:
            destination.mkdir(parents=True, exist_ok=True)
            final = destination / f"faceit_{match_id}.dem"
        final.parent.mkdir(parents=True, exist_ok=True)
        raw = final.with_name(final.name + ".download")
        self._stream(signed_url, raw)
        path = decompress(raw, final, _compression_of(resource_url))

        info = match_info_from_metadata(metadata)
        competition = info["competition"] or "faceit"
        date = info["date"] or "unknown date"
        acquisition: Acquisition = {
            "method": "faceit_data_api",
            "url": f"{BASE_URL}/matches/{match_id}",
            "retrievedAt": datetime.now(timezone.utc).date().isoformat(),
            "notes": "Metadata from the FACEIT Data API; file via the FACEIT Downloads API under approved access.",
        }
        return AcquiredDemo(
            path=path,
            acquisition=acquisition,
            match=info,
            licence=(
                "FACEIT-hosted match recording obtained through the FACEIT Downloads API under the "
                "operator's approved access. Not redistributable; rights in the recording stay with "
                "FACEIT and the participants. Reuse terms not verified: use only as private inspiration."
            ),
            content_lane="synthetic_only",
            provenance_note=(
                f"FACEIT match {match_id}, competition {competition}, played {date}. "
                "Used only to inspire timings, economy and positions in original synthetic cases; "
                "no player or team is named and no case claims to reproduce this match."
            ),
        )
