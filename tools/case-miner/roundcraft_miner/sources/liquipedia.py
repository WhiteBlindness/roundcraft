"""Liquipedia metadata client (MediaWiki API only). Not a demo source.

Used for optional context: tournament, team and date metadata for a match a human
editor already has. Follows the Liquipedia API terms of use (see
docs/content-sources.md):

* only the MediaWiki API, never generated HTML pages;
* a descriptive User-Agent with contact details, from LIQUIPEDIA_USER_AGENT;
* at most one request per 2 seconds (this client enforces it, also across runs);
* gzip responses accepted;
* results cached on disk so identical requests are never repeated;
* `action=parse` is refused (Liquipedia limits it to a much lower rate; wikitext
  from `action=query` is enough for infobox fields);
* CC BY-SA attribution text is returned with every result.

Nothing here reads player rosters or nicknames: only whitelisted scalar infobox fields.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from .. import paths
from .base import SourceError

USER_AGENT_ENV = "LIQUIPEDIA_USER_AGENT"
DEFAULT_WIKI = "counterstrike"
MIN_INTERVAL_SECONDS = 2.0
CACHE_TTL_SECONDS = 7 * 24 * 3600
TIMEOUT_SECONDS = 30
LICENCE = "CC BY-SA 3.0"

_WIKI_RE = re.compile(r"^[a-z0-9]+$")
_GENERIC_AGENTS = ("python-requests", "python-urllib", "go-http-client", "node-fetch", "curl/")

# Infobox fields worth keeping. Scalar, non-personal.
TOURNAMENT_FIELDS = ("name", "organizer", "sdate", "edate", "date", "liquipediatier", "type", "country", "city")
TEAM_FIELDS = ("name", "region", "location", "created")

# Indirection points so tests never sleep or touch the wall clock.
_clock = time.time
_sleep = time.sleep


def attribution(wiki: str, title: str) -> str:
    page = urllib.parse.quote(title.replace(" ", "_"), safe="_()-,'")
    return f"Source: Liquipedia (https://liquipedia.net/{wiki}/{page}), licensed {LICENCE}."


def parse_infobox(wikitext: str, wanted: tuple[str, ...]) -> tuple[str | None, dict[str, str]]:
    """Read `|key=value` lines of the first Infobox template from wikitext (not HTML)."""
    start = re.search(r"\{\{\s*Infobox[ _]([A-Za-z0-9 _]+?)\s*(?:\n|\|)", wikitext)
    if not start:
        return None, {}
    kind = start.group(1).strip()
    fields: dict[str, str] = {}
    depth = 0
    for index, line in enumerate(wikitext[start.start() :].splitlines()):
        # Only top-level `|key=value` lines belong to the infobox itself.
        found = re.match(r"^\|\s*([A-Za-z0-9_]+)\s*=\s*(.*)$", line)
        if index > 0 and depth == 1 and found and found.group(1).lower() in wanted and found.group(2).strip():
            value = re.sub(r"<[^>]+>", "", found.group(2)).strip()
            value = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", value)
            fields.setdefault(found.group(1).lower(), value)
        depth += line.count("{{") - line.count("}}")
        if depth <= 0:
            break
    return kind, fields


class LiquipediaClient:
    def __init__(
        self,
        user_agent: str | None = None,
        cache_dir: Path | None = None,
        min_interval: float = MIN_INTERVAL_SECONDS,
        cache_ttl: float = CACHE_TTL_SECONDS,
    ) -> None:
        self._user_agent = user_agent if user_agent is not None else os.environ.get(USER_AGENT_ENV, "")
        self.cache_dir = cache_dir or (paths.data_root() / "cache" / "liquipedia")
        self.min_interval = max(min_interval, MIN_INTERVAL_SECONDS)  # the terms floor; never lower
        self.cache_ttl = cache_ttl

    # -- politeness --------------------------------------------------------

    def _check_agent(self) -> str:
        agent = self._user_agent.strip()
        if not agent:
            raise SourceError(
                f"{USER_AGENT_ENV} is not set. Liquipedia requires a descriptive User-Agent with contact "
                'details, e.g. export LIQUIPEDIA_USER_AGENT="Roundcraft-case-miner/0.1 '
                '(https://example.org/; you@example.org)". Generic agents are blocked.'
            )
        if any(agent.lower().startswith(g) for g in _GENERIC_AGENTS) or "(" not in agent:
            raise SourceError(f"{USER_AGENT_ENV} must name the project and include contact details in parentheses.")
        return agent

    def _stamp_path(self) -> Path:
        return self.cache_dir / ".last_request"

    def _pace(self) -> None:
        """Keep >= min_interval between requests, including across separate runs."""
        stamp = self._stamp_path()
        now = _clock()
        try:
            last = float(stamp.read_text().strip())
        except (OSError, ValueError):
            last = None
        if last is not None:
            remaining = self.min_interval - (now - last)
            if remaining > 0:
                _sleep(remaining)
                now = _clock()
        try:
            stamp.parent.mkdir(parents=True, exist_ok=True)
            stamp.write_text(repr(now))
        except OSError:
            pass  # pacing across runs is best effort

    # -- cache -------------------------------------------------------------

    def _cache_file(self, wiki: str, params: dict[str, str]) -> Path:
        canonical = json.dumps([wiki, sorted(params.items())], separators=(",", ":"))
        return self.cache_dir / f"{hashlib.sha256(canonical.encode()).hexdigest()[:24]}.json"

    def api(self, params: dict[str, str], wiki: str = DEFAULT_WIKI) -> dict[str, Any]:
        """One MediaWiki API call, cached. `action=parse` is not allowed."""
        agent = self._check_agent()
        if not _WIKI_RE.match(wiki):
            raise SourceError(f"Invalid wiki name: {wiki!r}")
        if params.get("action") == "parse":
            raise SourceError("action=parse is not used: Liquipedia rate-limits it far below the normal limit.")
        params = {**params, "format": "json"}
        cached = self._cache_file(wiki, params)
        try:
            entry = json.loads(cached.read_text(encoding="utf-8"))
            if _clock() - float(entry["fetchedAt"]) < self.cache_ttl:
                return entry["response"]
        except (OSError, ValueError, KeyError):
            pass

        url = f"https://liquipedia.net/{wiki}/api.php?{urllib.parse.urlencode(sorted(params.items()))}"
        request = urllib.request.Request(
            url, headers={"User-Agent": agent, "Accept-Encoding": "gzip", "Accept": "application/json"}
        )
        self._pace()
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                body = response.read()
                headers = getattr(response, "headers", None)
                if headers is not None and str(headers.get("Content-Encoding", "")).lower() == "gzip":
                    body = gzip.decompress(body)
            data = json.loads(body.decode("utf-8"))
        except urllib.error.HTTPError as error:
            raise SourceError(f"Liquipedia API error: HTTP {error.code}.") from error
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
            raise SourceError(f"Liquipedia API request failed: {error}") from error
        if not isinstance(data, dict) or "error" in data:
            raise SourceError(f"Liquipedia API returned an error: {data.get('error') if isinstance(data, dict) else data}")

        cached.parent.mkdir(parents=True, exist_ok=True)
        cached.write_text(
            json.dumps({"fetchedAt": _clock(), "response": data}, sort_keys=True, ensure_ascii=False), encoding="utf-8"
        )
        return data

    # -- metadata ----------------------------------------------------------

    def _page_wikitext(self, title: str, wiki: str) -> str:
        data = self.api(
            {
                "action": "query",
                "prop": "revisions",
                "rvprop": "content",
                "rvslots": "main",
                "titles": title,
                "redirects": "1",
            },
            wiki,
        )
        for page in ((data.get("query") or {}).get("pages") or {}).values():
            if "missing" in page:
                raise SourceError(f"Liquipedia page not found: {title}")
            revisions = page.get("revisions") or []
            if revisions:
                slot = (revisions[0].get("slots") or {}).get("main") or {}
                return str(slot.get("*") or slot.get("content") or revisions[0].get("*") or "")
        raise SourceError(f"Liquipedia page has no content: {title}")

    def tournament_metadata(self, title: str, wiki: str = DEFAULT_WIKI) -> dict[str, Any]:
        return self._metadata(title, wiki, "tournament", TOURNAMENT_FIELDS)

    def team_metadata(self, title: str, wiki: str = DEFAULT_WIKI) -> dict[str, Any]:
        return self._metadata(title, wiki, "team", TEAM_FIELDS)

    def _metadata(self, title: str, wiki: str, kind: str, wanted: tuple[str, ...]) -> dict[str, Any]:
        infobox, fields = parse_infobox(self._page_wikitext(title, wiki), wanted)
        if infobox is None:
            raise SourceError(f"No infobox found on Liquipedia page: {title}")
        return {
            "kind": kind,
            "page": title,
            "infobox": infobox,
            "fields": {key: fields[key] for key in sorted(fields)},
            "licence": LICENCE,
            "attribution": attribution(wiki, title),
        }
