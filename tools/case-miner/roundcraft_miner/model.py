"""Data contracts for the offline case miner.

Three layers, each written to its own file so they can never blur together:

1. SourceManifest   committed (content/sources/<source-id>.json). Provenance only.
2. NormalisedMatch  data-local/parsed/<source-id>/match.json. GROUND TRUTH:
                    everything the demo knows, anonymised (no names, no Steam IDs).
3. Candidate        data-local/candidates/<source-id>/<candidate-id>/candidate.json.
                    Splits PLAYER-KNOWN information (safe to put in a brief) from
                    GROUND TRUTH (reviewer-only context and the reveal).

The rule the whole pipeline is built around: a Roundcraft brief may only ever be
built from `Candidate.playerKnown`. Ground truth feeds the reveal and the
reviewer, never the brief.

All JSON is written with sorted keys, integer world coordinates and times
rounded to 0.01 s so re-running the pipeline on the same demo produces
byte-identical files.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Literal, NotRequired, TypedDict

SCHEMA_VERSION = 1
NORMALISER_VERSION = 1

Side = Literal["T", "CT"]
FactStatus = Literal["confirmed", "last_seen", "inferred", "unknown"]
UtilityKind = Literal["smoke", "flash", "he", "molotov", "decoy"]
ContentLane = Literal["synthetic_only", "professional_allowed"]


# ---------------------------------------------------------------------------
# 1. Source manifest (committed)
# ---------------------------------------------------------------------------


class Acquisition(TypedDict):
    method: Literal["local_file", "faceit_data_api", "public_test_corpus", "organiser_release"]
    url: str | None  # where it came from; None for a hand-supplied file
    retrievedAt: str  # ISO date
    notes: str


class DemoInfo(TypedDict):
    sha256: str
    bytes: int
    localFilename: str  # relative to data-local/demos/
    mapName: str
    patchVersion: str | None
    tickrate: int


class MatchInfo(TypedDict):
    competition: str | None  # e.g. "valve_matchmaking", "faceit", tournament name
    date: str | None
    teams: list[str] | None  # only when rights allow; never used for synthetic cases


class Rights(TypedDict):
    licence: str  # licence of the file we obtained, e.g. "MIT (test corpus)"
    contentLane: ContentLane
    provenanceNote: str  # what is and is not established about the underlying match


class ParserInfo(TypedDict):
    name: str
    version: str
    normaliserVersion: int


class SourceManifest(TypedDict):
    schemaVersion: int
    sourceId: str  # ^src_[a-z0-9_]+$
    acquisition: Acquisition
    demo: DemoInfo
    match: MatchInfo
    rights: Rights
    parser: ParserInfo


# ---------------------------------------------------------------------------
# 2. Normalised match (ground truth, data-local only)
# ---------------------------------------------------------------------------


class Utility(TypedDict):
    smoke: int
    flash: int
    he: int
    molotov: int  # molotov + incendiary
    decoy: int


class PlayerState(TypedDict):
    pid: str  # anonymised, stable within one match: "p01".."p10"
    side: Side
    alive: bool
    hp: int
    armor: int
    helmet: bool
    defuser: bool
    x: int
    y: int
    z: int
    place: str | None  # map place name from the demo (m_szLastPlaceName), e.g. "BombsiteA"
    activeWeapon: str | None
    primary: str | None
    secondary: str | None
    utility: Utility
    hasC4: bool
    money: int
    equipValue: int
    spottedBy: list[str]  # pids of enemies who can currently see this player (sorted)


class Frame(TypedDict):
    tick: int
    t: float  # seconds since freeze end
    bombPlanted: bool
    players: list[PlayerState]  # sorted by pid


class Event(TypedDict):
    tick: int
    t: float
    type: Literal[
        "kill",
        "utility",
        "bomb_pickup",
        "bomb_drop",
        "bomb_plant_begin",
        "bomb_planted",
        "bomb_defuse_begin",
        "bomb_defused",
        "bomb_exploded",
    ]
    # Every event carries the fields relevant to its type, e.g. for "kill":
    # attacker, victim, assister, weapon, headshot, attackerSide, victimSide,
    # attackerPlace, victimPlace, attackerX/Y, victimX/Y.
    # For "utility": kind, thrower, side, x, y, place.
    # For bomb events: player, site ("A" | "B" | None), place, x, y.
    data: dict[str, Any]


class Round(TypedDict):
    number: int  # 1-based
    freezeEndTick: int
    endTick: int
    winner: Side | None
    endReason: str  # e.g. "t_win_elimination", "bomb_exploded", "bomb_defused", "time_ran_out"
    scoreBefore: dict[Side, int]
    roundTimeSeconds: float  # round clock after freeze time
    bombTimerSeconds: float
    frames: list[Frame]  # sampled every `sampleEveryTicks`
    events: list[Event]  # sorted by (tick, type)


class NormalisedMatch(TypedDict):
    schemaVersion: int
    normaliserVersion: int
    sourceId: str
    demoSha256: str
    map: str
    tickrate: int
    sampleEveryTicks: int
    players: list[str]  # pids
    rounds: list[Round]
    # Data-quality notes from normalisation (dropped rounds, inferred actors, ...). Omitted when empty.
    warnings: NotRequired[list[str]]


# ---------------------------------------------------------------------------
# 3. Candidate (player-known view + reviewer-only ground truth)
# ---------------------------------------------------------------------------


class KnownEnemy(TypedDict):
    pid: str
    status: FactStatus  # confirmed (seen within the confirm window) | last_seen | unknown
    place: NotRequired[str | None]
    x: NotRequired[int]
    y: NotRequired[int]
    ageSeconds: NotRequired[float]
    weaponSeen: NotRequired[str | None]


class KnownBomb(TypedDict):
    status: Literal["carried", "dropped", "planted", "unknown"]
    knowledge: FactStatus
    place: NotRequired[str | None]
    site: NotRequired[str | None]
    ageSeconds: NotRequired[float]


class ObservedUtility(TypedDict):
    kind: UtilityKind
    side: Side  # who threw it
    place: str | None
    x: int
    y: int
    ageSeconds: float


class DerivedFact(TypedDict):
    id: str
    status: FactStatus
    text: str
    basis: str  # why this status: e.g. "spotted by own player 3.5 s ago", "HUD alive count"


class KnowledgeView(TypedDict):
    perspective: Side
    tick: int
    t: float
    clock: dict[str, float | None]  # {"roundSecondsLeft": .., "bombSecondsLeft": .. | None}
    alive: dict[str, int]  # {"own": n, "enemy": n} — shown on the HUD, so confirmed
    own: list[PlayerState]  # own alive players; fully known to the team
    enemies: list[KnownEnemy]  # one entry per ALIVE enemy; unknown ones carry no position
    bomb: KnownBomb
    utilityObserved: list[ObservedUtility]
    facts: list[DerivedFact]


class FollowUp(TypedDict):
    tick: int
    t: float
    kind: str  # "enemy_spotted" | "kill" | "bomb_planted" | "utility_seen" | ...
    summary: str  # player-known wording of what changed
    newFacts: list[DerivedFact]
    knowledgeAfter: KnowledgeView


class Score(TypedDict):
    total: float  # 0..1
    factors: dict[str, float]  # each 0..1, see mine/scoring.py for definitions


class Candidate(TypedDict):
    schemaVersion: int
    candidateId: str  # see candidate_id()
    sourceId: str
    map: str
    round: int
    decisionTick: int
    decisionT: float
    perspective: Side
    category: str
    summary: str
    score: Score
    playerKnown: KnowledgeView
    followUp: FollowUp | None
    groundTruth: dict[str, Any]  # reviewer-only: enemy states, timelines, outcome
    actualLine: str  # what the perspective team actually did next (reveal only)
    reviewNotes: list[str]  # disputed assumptions, alternative lines, caveats


# ---------------------------------------------------------------------------
# Helpers shared by every stage
# ---------------------------------------------------------------------------


def candidate_id(demo_sha256: str, round_number: int, tick: int, perspective: Side, category: str) -> str:
    """Stable across re-runs: depends only on the demo bytes and the decision point."""
    key = f"{demo_sha256}:{round_number}:{tick}:{perspective}:{category}"
    return f"cand_{hashlib.sha256(key.encode()).hexdigest()[:12]}"


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()
