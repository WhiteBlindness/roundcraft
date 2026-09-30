from __future__ import annotations

import gzip
import io
import json
import urllib.request

import pytest

from roundcraft_miner.sources import liquipedia
from roundcraft_miner.sources.base import SourceError

AGENT = "RoundcraftTest/0.1 (https://example.org; test@example.org)"

WIKITEXT = """{{Infobox league
|name=Example Open 2025
|organizer=[[Example Org|Example Org]]
|sdate=2025-03-01
|edate=2025-03-09
|liquipediatier=1
|prizepool=$100,000
|nested={{Foo
|name=Ignored
}}
|participants=PlayerOne
}}
Body text.
"""

RESPONSE = {"query": {"pages": {"1": {"title": "Example Open", "revisions": [{"slots": {"main": {"*": WIKITEXT}}}]}}}}


class FakeResponse(io.BytesIO):
    def __init__(self, body: bytes, headers: dict[str, str] | None = None):
        super().__init__(body)
        self.headers = headers or {}

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


@pytest.fixture
def clock(monkeypatch):
    state = {"now": 1000.0, "sleeps": []}
    monkeypatch.setattr(liquipedia, "_clock", lambda: state["now"])

    def sleep(seconds):
        state["sleeps"].append(seconds)
        state["now"] += seconds

    monkeypatch.setattr(liquipedia, "_sleep", sleep)
    return state


@pytest.fixture
def http(monkeypatch):
    calls = []

    def fake(request, timeout=None):
        calls.append(request)
        return FakeResponse(json.dumps(RESPONSE).encode())

    monkeypatch.setattr(urllib.request, "urlopen", fake)
    return calls


def client(tmp_path, **kw):
    return liquipedia.LiquipediaClient(user_agent=AGENT, cache_dir=tmp_path / "cache", **kw)


def test_missing_user_agent(monkeypatch, tmp_path, http):
    monkeypatch.delenv("LIQUIPEDIA_USER_AGENT", raising=False)
    with pytest.raises(SourceError, match="LIQUIPEDIA_USER_AGENT"):
        liquipedia.LiquipediaClient(cache_dir=tmp_path).tournament_metadata("Example_Open")
    assert http == []


def test_generic_user_agent_rejected(tmp_path, http):
    with pytest.raises(SourceError):
        liquipedia.LiquipediaClient(user_agent="python-requests/2.0", cache_dir=tmp_path).api({"action": "query"})


def test_tournament_metadata_and_headers(tmp_path, clock, http):
    meta = client(tmp_path).tournament_metadata("Example_Open")
    assert meta["fields"] == {
        "edate": "2025-03-09",
        "liquipediatier": "1",
        "name": "Example Open 2025",
        "organizer": "Example Org",
        "sdate": "2025-03-01",
    }
    assert "CC BY-SA" in meta["attribution"] and "liquipedia.net/counterstrike/Example_Open" in meta["attribution"]
    request = http[0]
    assert request.full_url.startswith("https://liquipedia.net/counterstrike/api.php?")
    assert request.get_header("User-agent") == AGENT
    assert request.get_header("Accept-encoding") == "gzip"


def test_gzip_body_decoded(monkeypatch, tmp_path, clock):
    body = gzip.compress(json.dumps(RESPONSE).encode())
    monkeypatch.setattr(urllib.request, "urlopen", lambda r, timeout=None: FakeResponse(body, {"Content-Encoding": "gzip"}))
    assert client(tmp_path).tournament_metadata("Example_Open")["fields"]["name"] == "Example Open 2025"


def test_cache_hit_avoids_second_request(tmp_path, clock, http):
    c = client(tmp_path)
    first = c.tournament_metadata("Example_Open")
    second = client(tmp_path).tournament_metadata("Example_Open")  # fresh client, same disk cache
    assert first == second
    assert len(http) == 1
    assert any((tmp_path / "cache").glob("*.json"))


def test_expired_cache_refetches(tmp_path, clock, http):
    c = client(tmp_path, cache_ttl=10)
    c.tournament_metadata("Example_Open")
    clock["now"] += 100
    c.tournament_metadata("Example_Open")
    assert len(http) == 2


def test_min_interval_between_requests(tmp_path, clock, http):
    c = client(tmp_path, min_interval=0.1)  # cannot go below the 2 s floor
    c.tournament_metadata("A")
    clock["now"] += 0.5
    c.tournament_metadata("B")
    assert len(http) == 2
    assert clock["sleeps"] == [pytest.approx(1.5)]


def test_spacing_persists_across_clients(tmp_path, clock, http):
    client(tmp_path).tournament_metadata("A")
    client(tmp_path).tournament_metadata("B")
    assert clock["sleeps"] == [pytest.approx(2.0)]


def test_parse_action_refused(tmp_path, http):
    with pytest.raises(SourceError, match="parse"):
        client(tmp_path).api({"action": "parse", "page": "X"})
    assert http == []


def test_team_metadata_skips_roster(tmp_path, clock, monkeypatch):
    text = "{{Infobox team\n|name=Team Alpha\n|region=Europe\n|players=PlayerOne\n}}"
    resp = {"query": {"pages": {"1": {"revisions": [{"slots": {"main": {"*": text}}}]}}}}
    monkeypatch.setattr(urllib.request, "urlopen", lambda r, timeout=None: FakeResponse(json.dumps(resp).encode()))
    meta = client(tmp_path).team_metadata("Team_Alpha")
    assert meta["fields"] == {"name": "Team Alpha", "region": "Europe"}
    assert "PlayerOne" not in json.dumps(meta)
