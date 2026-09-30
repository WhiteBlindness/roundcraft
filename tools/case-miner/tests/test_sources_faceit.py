from __future__ import annotations

import gzip
import io
import json
import urllib.request

import pytest

from roundcraft_miner.sources import faceit
from roundcraft_miner.sources.base import SourceError

MATCH_ID = "1-cb038819-b0d0-4471-b25c-0e7468ab1eb1"

METADATA = {
    "match_id": MATCH_ID,
    "competition_name": "Example Open",
    "finished_at": 1_700_000_000,
    "voting": {"map": {"pick": ["de_mirage"]}},
    "teams": {
        "faction1": {"name": "Team Alpha", "roster": [{"nickname": "PlayerOne", "player_id": "abc"}]},
        "faction2": {"name": "Team Beta", "roster": [{"nickname": "PlayerTwo", "player_id": "def"}]},
    },
    "demo_url": [f"https://demos.faceit.com/cs2/{MATCH_ID}.dem.gz"],
}


class FakeResponse(io.BytesIO):
    headers: dict[str, str] = {}

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def install_urlopen(monkeypatch, handler):
    calls: list[urllib.request.Request] = []

    def fake(request, timeout=None):
        calls.append(request)
        return handler(request)

    monkeypatch.setattr(urllib.request, "urlopen", fake)
    return calls


def no_sleep(monkeypatch):
    monkeypatch.setattr(faceit.time, "sleep", lambda s: None)


def test_missing_key_raises_source_error(monkeypatch):
    monkeypatch.delenv("FACEIT_API_KEY", raising=False)
    calls = install_urlopen(monkeypatch, lambda r: FakeResponse(b"{}"))
    with pytest.raises(SourceError, match="FACEIT_API_KEY"):
        faceit.FaceitDataClient().get_match(MATCH_ID)
    assert calls == []


def test_bad_match_id_rejected(monkeypatch):
    with pytest.raises(SourceError, match="not a FACEIT match id"):
        faceit.FaceitDataClient(api_key="k").get_match("../etc/passwd")


def test_get_match_sends_bearer_key_and_parses(monkeypatch):
    no_sleep(monkeypatch)
    calls = install_urlopen(monkeypatch, lambda r: FakeResponse(json.dumps(METADATA).encode()))
    data = faceit.FaceitDataClient(api_key="secret-key").get_match(f"https://www.faceit.com/en/cs2/room/{MATCH_ID}")
    assert data["match_id"] == MATCH_ID
    assert calls[0].full_url == f"https://open.faceit.com/data/v4/matches/{MATCH_ID}"
    assert calls[0].get_header("Authorization") == "Bearer secret-key"


def test_metadata_mapping_excludes_names():
    info = faceit.match_info_from_metadata(METADATA)
    assert info == {"competition": "Example Open", "date": "2023-11-14", "teams": None}
    blob = json.dumps(info)
    for name in ("PlayerOne", "PlayerTwo", "Team Alpha", "Team Beta"):
        assert name not in blob
    assert faceit.map_name_from_metadata(METADATA) == "de_mirage"


def test_rate_limiter_spacing(monkeypatch):
    sleeps: list[float] = []
    now = [100.0]
    monkeypatch.setattr(faceit.time, "monotonic", lambda: now[0])
    monkeypatch.setattr(faceit.time, "sleep", lambda s: (sleeps.append(s), now.__setitem__(0, now[0] + s)))
    install_urlopen(monkeypatch, lambda r: FakeResponse(json.dumps(METADATA).encode()))
    client = faceit.FaceitDataClient(api_key="k", min_interval=0.5)
    client.get_match(MATCH_ID)
    now[0] += 0.1
    client.get_match(MATCH_ID)
    assert sleeps == [pytest.approx(0.4)]


def test_downloads_api_required_raises_setup_message(monkeypatch, tmp_path):
    monkeypatch.setenv("FACEIT_API_KEY", "k")
    monkeypatch.delenv("FACEIT_DOWNLOADS_TOKEN", raising=False)
    monkeypatch.delenv("FACEIT_DOWNLOADS_ENDPOINT", raising=False)
    no_sleep(monkeypatch)
    calls = install_urlopen(monkeypatch, lambda r: FakeResponse(json.dumps(METADATA).encode()))
    with pytest.raises(SourceError) as info:
        faceit.FaceitSource().acquire(MATCH_ID, tmp_path)
    message = str(info.value)
    assert "Downloads API" in message and "FACEIT_DOWNLOADS_TOKEN" in message and "docs.faceit.com" in message
    assert len(calls) == 1  # metadata only; the private demo_url is never fetched
    assert list(tmp_path.iterdir()) == []


def test_no_demo_url(monkeypatch, tmp_path):
    monkeypatch.setenv("FACEIT_API_KEY", "k")
    no_sleep(monkeypatch)
    install_urlopen(monkeypatch, lambda r: FakeResponse(json.dumps({**METADATA, "demo_url": []}).encode()))
    with pytest.raises(SourceError, match="no demo_url"):
        faceit.FaceitSource().acquire(MATCH_ID, tmp_path)


def test_acquire_with_downloads_access_decompresses_gz(monkeypatch, tmp_path):
    monkeypatch.setenv("FACEIT_API_KEY", "k")
    monkeypatch.setenv("FACEIT_DOWNLOADS_TOKEN", "tok")
    monkeypatch.setenv("FACEIT_DOWNLOADS_ENDPOINT", "https://downloads.example.test/exchange")
    no_sleep(monkeypatch)
    demo = b"PBDEMS2\x00" + b"x" * 5000

    def handler(request):
        url = request.full_url
        if url.startswith("https://open.faceit.com/data/v4/matches/"):
            return FakeResponse(json.dumps(METADATA).encode())
        if url == "https://downloads.example.test/exchange":
            assert json.loads(request.data) == {"resource_url": METADATA["demo_url"][0]}
            assert request.get_header("Authorization") == "Bearer tok"
            return FakeResponse(json.dumps({"payload": {"download_url": "https://cdn.example.test/signed?sig=1"}}).encode())
        assert url == "https://cdn.example.test/signed?sig=1"
        return FakeResponse(gzip.compress(demo))

    install_urlopen(monkeypatch, handler)
    acquired = faceit.FaceitSource().acquire(MATCH_ID, tmp_path)
    assert acquired.path.read_bytes() == demo
    assert acquired.path.suffix == ".dem"
    assert acquired.content_lane == "synthetic_only"
    assert acquired.acquisition["method"] == "faceit_data_api"
    assert MATCH_ID in acquired.provenance_note and "Example Open" in acquired.provenance_note
    assert "PlayerOne" not in acquired.provenance_note and "Team Alpha" not in acquired.provenance_note
    assert not any(p.name.endswith(".download") for p in tmp_path.iterdir())
    assert "secret" not in json.dumps(acquired.acquisition)


def test_zst_without_stdlib_decoder_raises(tmp_path):
    src = tmp_path / "a.dem.download"
    src.write_bytes(b"\x28\xb5\x2f\xfd")
    try:
        import compression.zstd  # noqa: F401
    except ImportError:
        with pytest.raises(SourceError, match="zstd"):
            faceit.decompress(src, tmp_path / "a.dem", "zst")
