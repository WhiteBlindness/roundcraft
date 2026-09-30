"""Text helpers for the drafter: identity scrubbing, place names, and the validator's
6-word disclosure check re-implemented so a draft can verify itself before it is written."""

from __future__ import annotations

import re
import unicodedata

SHARED_WORD_WINDOW = 6  # mirrors SHARED_WORD_WINDOW in scripts/content/validate.ts

_PID = re.compile(r"\bp\d{2}\b", re.IGNORECASE)
_LONG_NUMBER = re.compile(r"\b\d{15,}\b")
_STEAM = re.compile(r"\bSTEAM_\d:\d:\d+\b", re.IGNORECASE)
_IDENT_ID = re.compile(r"[^a-z0-9_]+")


def scrub(text: str) -> str:
    """Remove anything that looks like a player identifier from player-facing text."""
    text = _STEAM.sub("", text)
    text = _LONG_NUMBER.sub("", text)
    text = _PID.sub("a player", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def has_identity(text: str) -> bool:
    return bool(_PID.search(text) or _LONG_NUMBER.search(text) or _STEAM.search(text))


def slug(value: str, *, max_len: int = 40) -> str:
    """Lower-case identifier fragment matching ^[a-z0-9_]+$."""
    cleaned = _IDENT_ID.sub("_", value.strip().lower()).strip("_")
    cleaned = re.sub(r"_+", "_", cleaned) or "x"
    return cleaned[:max_len].strip("_") or "x"


_PLACE_FIXES = {"Topof": "Top of", "Bottomof": "Bottom of", "Outof": "Out of", "Snipers Nest": "Sniper's Nest"}


def pretty_place(place: str | None) -> str | None:
    """'BombsiteA' -> 'Bombsite A', 'CTSpawn' -> 'CT Spawn'. Idempotent on spaced names."""
    if not place:
        return None
    compact = re.sub(r"\s+", "", place.strip())
    site = re.fullmatch(r"(?i)bombsite([AB])", compact)
    if site:
        return f"{site.group(1).upper()} site"
    text = place.strip().replace("_", " ")
    text = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", text)
    text = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", text)
    text = re.sub(r"(?<=[A-Za-z])(?=\d)", " ", text)
    for wrong, right in _PLACE_FIXES.items():
        text = text.replace(wrong, right)
    return re.sub(r"\s{2,}", " ", text).strip() or None


def fix_weapon_articles(text: str) -> str:
    """'with a Dual Berettas' -> 'with Dual Berettas' (plural weapon names take no article)."""
    return re.sub(r"\b([Aa]n?) (Dual Berettas)\b", r"\2", text)


def map_display(map_name: str) -> str:
    name = map_name[3:] if map_name.startswith("de_") else map_name
    return name.replace("_", " ").title()


def map_slug(map_name: str) -> str:
    return slug(map_name[3:] if map_name.startswith("de_") else map_name, max_len=16)


def seconds_phrase(seconds: float | int | None) -> str:
    if seconds is None:
        return "an unknown time"
    whole = max(0, int(round(seconds)))
    return f"{whole} second" if whole == 1 else f"{whole} seconds"


def clock_label(seconds: float) -> str:
    whole = max(0, int(round(seconds)))
    return f"{whole // 60:02d}:{whole % 60:02d}"


def truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rstrip()
    return cut.rsplit(" ", 1)[0].rstrip(",;:") + "…" if " " in cut else cut + "…"


# ---------------------------------------------------------------------------
# 6-word overlap (same tokenisation as validate.ts)
# ---------------------------------------------------------------------------



def words(text: str) -> list[str]:
    text = unicodedata.normalize("NFKD", text.lower())
    return [token for token in re.split(r"[\W_]+", text, flags=re.UNICODE) if token]


def shingles(text: str, window: int = SHARED_WORD_WINDOW) -> list[str]:
    tokens = words(text)
    return [" ".join(tokens[i : i + window]) for i in range(len(tokens) - window + 1)]


def shared_gram(text: str, banned: set[str]) -> str | None:
    for gram in shingles(text):
        if gram in banned:
            return gram
    return None


_REWRITES: tuple[tuple[str, str], ...] = (
    (r"\blast seen in\b", "last spotted in"),
    (r"\bwas spotted in\b", "was seen in"),
    (r"\bwere spotted in\b", "were seen in"),
    (r"\bis visible in\b", "can be seen in"),
    (r"\bare visible in\b", "can be seen in"),
    (r"\bremain on the bomb timer\b", "are left on the bomb timer"),
    (r"\bremain on the round clock\b", "are left on the round clock"),
    (r"\balive against\b", "still up against"),
    (r"\bpositions of\b", "locations of"),
    (r"\b(?:is|are) unknown\b", "cannot be placed"),
    (r"\bdetonated a\b", "set off a"),
    (r"\bright now\b", "at this moment"),
    (r"\bYour team is positioned\b", "Your players are placed"),
    (r"\bhas not been planted\b", "is not planted yet"),
    (r"\bthe bomb is planted\b", "the bomb has been planted"),
)


def break_overlap(text: str, banned: set[str], bridge: str = "notably") -> tuple[str, bool]:
    """Remove every 6-word sequence shared with `banned` so the validator's disclosure check passes.

    Strategy: (1) phrase rewrites that keep the meaning ("last seen in" -> "last spotted in");
    (2) as a last resort insert a bridge word inside the shared window. Templates are written to
    avoid overlap, so this mostly fires on wording that came from candidate data."""
    changed = False
    for pattern, replacement in _REWRITES:
        if shared_gram(text, banned) is None:
            return text, changed
        new = re.sub(pattern, lambda m: replacement[0].upper() + replacement[1:] if m.group(0)[:1].isupper() else replacement, text, flags=re.IGNORECASE)
        if new != text:
            text, changed = new, True
    for _ in range(40):
        gram = shared_gram(text, banned)
        if gram is None:
            return text, changed
        raw = text.split(" ")
        counts = [len(words(chunk)) for chunk in raw]
        tokens = words(text)
        gram_tokens = gram.split(" ")
        start = next(
            (i for i in range(len(tokens) - len(gram_tokens) + 1) if tokens[i : i + len(gram_tokens)] == gram_tokens),
            None,
        )
        if start is None:
            return text, changed
        target_token = start + len(gram_tokens) // 2
        running = 0
        insert_after = len(raw) - 1
        for index, count in enumerate(counts):
            running += count
            if running > target_token:
                insert_after = index
                break
        raw.insert(insert_after + 1, bridge)
        text = " ".join(raw)
        changed = True
    return text, changed
