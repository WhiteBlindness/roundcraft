"""Decision features extracted from Candidate.playerKnown (+ perspective/map/category) ONLY.

Nothing in this module reads Candidate.groundTruth or Candidate.actualLine: the brief, the evidence
options and the rubric priors are all derived from what the player could know at the decision point.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .text import pretty_place

DEFUSE_SECONDS_KIT = 5.0
DEFUSE_SECONDS_NO_KIT = 10.0
TRAVEL_ALLOWANCE_SECONDS = 7.0  # heuristic prior: minimum travel + clear time on top of the defuse
COMFORTABLE_SECONDS = 25.0  # heuristic prior: "plenty of time" threshold
UNKNOWN_TIME_FALLBACK = 30.0
STALE_SIGHTING_SECONDS = 15.0  # heuristic prior: older sightings are not named as a target in an option


@dataclass(frozen=True)
class KnownEnemyView:
    place: str | None  # pretty place name, from playerKnown only
    status: str
    age: float | None
    weapon: str | None


@dataclass
class Features:
    situation: str
    perspective: str
    map_name: str
    time_left: float | None  # bomb seconds when planted, else round seconds
    time_kind: str  # "bomb" | "round" | "unknown"
    own_alive: int
    enemy_alive: int
    own_kit: int
    util: dict[str, int]
    known_enemies: list[KnownEnemyView]
    unknown_enemies: int
    observed_enemy_utility: list[str]
    bomb_status: str
    bomb_place: str | None
    bomb_site: str | None
    enemy_noun: str
    category: str = ""
    notes: list[str] = field(default_factory=list)

    @property
    def time(self) -> float:
        return self.time_left if self.time_left is not None else UNKNOWN_TIME_FALLBACK

    @property
    def adv(self) -> int:
        return self.own_alive - self.enemy_alive

    @property
    def util_total(self) -> int:
        return sum(self.util.values())

    @property
    def defuse_needed(self) -> float:
        return DEFUSE_SECONDS_KIT if self.own_kit > 0 else DEFUSE_SECONDS_NO_KIT

    @property
    def t_low(self) -> float:
        return self.defuse_needed + TRAVEL_ALLOWANCE_SECONDS

    @property
    def t_high(self) -> float:
        return COMFORTABLE_SECONDS

    @property
    def info_level(self) -> float:
        total = len(self.known_enemies) + self.unknown_enemies
        return len(self.known_enemies) / total if total else 0.0

    @property
    def place(self) -> str | None:
        """Place of the freshest known enemy position (player-known), if it is fresh enough to name in an option."""
        with_place = [e for e in self.known_enemies if e.place and (e.age is None or e.age <= STALE_SIGHTING_SECONDS)]
        if not with_place:
            return None
        with_place.sort(key=lambda e: (e.age if e.age is not None else 0.0, e.place or ""))
        return with_place[0].place

    def describe(self) -> str:
        time = "unknown" if self.time_left is None else f"{self.time_left:.0f}s ({self.time_kind})"
        return (
            f"situation={self.situation} time_left={time} own_alive={self.own_alive} enemy_alive={self.enemy_alive} "
            f"adv={self.adv:+d} kits={self.own_kit} utility={self.util_total} "
            f"known_enemies={len(self.known_enemies)} unknown_enemies={self.unknown_enemies}"
        )


_RETAKE_WORDS = ("retake",)
_POST_PLANT_WORDS = ("post_plant", "postplant", "post-plant")


def resolve_situation(category: str, perspective: str, bomb_status: str, bomb_seconds: float | None) -> str:
    """Map a candidate category (+ perspective and bomb state) onto one of the four template families."""
    cat = (category or "").lower()
    planted = bomb_status == "planted" or bomb_seconds is not None
    if planted or any(word in cat for word in _POST_PLANT_WORDS + _RETAKE_WORDS):
        return "retake" if perspective == "CT" else "post_plant_hold"
    return "execute_or_default" if perspective == "T" else "hold_or_rotate"


def extract_features(candidate: dict[str, Any]) -> Features:
    view = candidate["playerKnown"]
    perspective = candidate.get("perspective") or view.get("perspective") or "CT"
    clock = view.get("clock") or {}
    bomb = view.get("bomb") or {}
    bomb_seconds = clock.get("bombSecondsLeft")
    round_seconds = clock.get("roundSecondsLeft")
    situation = resolve_situation(candidate.get("category", ""), perspective, bomb.get("status", "unknown"), bomb_seconds)
    if bomb_seconds is not None:
        time_left, time_kind = float(bomb_seconds), "bomb"
    elif round_seconds is not None:
        time_left, time_kind = float(round_seconds), "round"
    else:
        time_left, time_kind = None, "unknown"

    own = view.get("own") or []
    alive = view.get("alive") or {}
    own_alive = int(alive.get("own", len(own)))
    enemy_alive = int(alive.get("enemy", len(view.get("enemies") or [])))
    util = {"smoke": 0, "flash": 0, "he": 0, "molotov": 0, "decoy": 0}
    kits = 0
    for player in own:
        for kind, count in (player.get("utility") or {}).items():
            util[kind] = util.get(kind, 0) + int(count)
        kits += 1 if player.get("defuser") else 0

    known: list[KnownEnemyView] = []
    unknown = 0
    for enemy in view.get("enemies") or []:
        status = enemy.get("status", "unknown")
        if status in ("confirmed", "last_seen") and enemy.get("place"):
            known.append(
                KnownEnemyView(
                    place=pretty_place(enemy.get("place")),
                    status=status,
                    age=enemy.get("ageSeconds"),
                    weapon=enemy.get("weaponSeen"),
                )
            )
        else:
            unknown += 1

    enemy_side = "T" if perspective == "CT" else "CT"
    observed = [u["kind"] for u in (view.get("utilityObserved") or []) if u.get("side") == enemy_side]
    site = bomb.get("site")
    features = Features(
        situation=situation,
        perspective=perspective,
        map_name=candidate.get("map", ""),
        time_left=time_left,
        time_kind=time_kind,
        own_alive=own_alive,
        enemy_alive=enemy_alive,
        own_kit=kits if perspective == "CT" else 0,
        util=util,
        known_enemies=known,
        unknown_enemies=unknown,
        observed_enemy_utility=observed,
        bomb_status=bomb.get("status", "unknown"),
        bomb_place=pretty_place(bomb.get("place")),
        bomb_site=site,
        enemy_noun="attacker" if perspective == "CT" else "defender",
        category=str(candidate.get("category", "")),
    )
    if time_left is None:
        features.notes.append("No clock in the player-known view; time rules assumed 30 s.")
    return features
