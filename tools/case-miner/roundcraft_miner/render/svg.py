"""Abstract tactical-desk diagrams for reviewers and (player-known only) briefs.

No radar images or game assets are used. The map silhouette is derived from the
demo itself: every sampled player position across the whole match is binned into
a grid and drawn as light cells, so the walkable area of the map appears without
any third-party artwork. The projection depends only on the match, so every
candidate of one match shares the same transform.

Two diagrams per candidate:

* playerKnown   what the perspective team knows at the decision tick. Confirmed
                enemies are filled, last-seen enemies hollow and dashed with an
                age, unknown enemies are NOT drawn (only counted in the legend).
* groundTruth   reviewer only: adds every alive enemy at its true position and
                a faint line from each last-seen marker to the truth.

Output is deterministic: fixed float formatting, stable ordering, pure string
building with the standard library.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape, quoteattr

# ---------------------------------------------------------------------------
# Layout and palette
# ---------------------------------------------------------------------------

VIEW = 1000
MARGIN_X = 40
MAP_TOP = 110
MAP_BOTTOM = 880
CELL_UNITS = 56
CLOSING_MIN_NEIGHBOURS = 3
PATH_STEP_MAX_UNITS = 900  # do not bridge teleports (round resets, gaps in sampling)
MIN_PLACE_SAMPLES = 12
SMOKE_RADIUS_UNITS = 144
MOLOTOV_RADIUS_UNITS = 110

PALETTE = {
    "bg": "#f7f5ef",
    "cell": "#d9d5c6",
    "ink": "#1f2328",
    "ink_soft": "#454b54",
    "CT": "#1f5fbf",
    "T": "#a45a00",
    "smoke_fill": "#8a8f98",
    "smoke_stroke": "#5b6068",
    "molotov_fill": "#e8863a",
    "molotov_stroke": "#a4470a",
    "bomb": "#1f2328",
    "gt": "#7a1fa2",
    "white": "#ffffff",
}
FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

GROUND_TRUTH_BANNER = "Ground truth — reviewer only, never shown to players"

_PLACE_SPECIAL = {
    "BombsiteA": "A site",
    "BombsiteB": "B site",
    "CTSpawn": "CT spawn",
    "TSpawn": "T spawn",
}
_CAMEL_SPLIT = re.compile(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|(?<=[a-z])(?=[0-9])")


def prettify_place(name: str) -> str:
    if name in _PLACE_SPECIAL:
        return _PLACE_SPECIAL[name]
    spaced = _CAMEL_SPLIT.sub(" ", name.replace("_", " ")).strip()
    spaced = re.sub(r"\b([A-Z][a-z]+)of\b", r"\1 of", spaced)  # "TopofMid" -> "Top of Mid"
    return re.sub(r"\s+", " ", spaced)


def fmt(value: float) -> str:
    text = f"{value:.1f}"
    return "0.0" if text == "-0.0" else text


def _srgb(channel: int) -> float:
    c = channel / 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def contrast_ratio(fg: str, bg: str) -> float:
    def lum(hex_colour: str) -> float:
        r, g, b = (int(hex_colour[i : i + 2], 16) for i in (1, 3, 5))
        return 0.2126 * _srgb(r) + 0.7152 * _srgb(g) + 0.0722 * _srgb(b)

    a, b = sorted((lum(fg), lum(bg)), reverse=True)
    return (a + 0.05) / (b + 0.05)


# ---------------------------------------------------------------------------
# Map view: footprint, projection, place labels (derived from the match only)
# ---------------------------------------------------------------------------


def _iter_positions(match: dict[str, Any]):
    for rnd in match.get("rounds", []):
        previous: dict[str, tuple[int, int]] = {}
        for frame in rnd.get("frames", []):
            current: dict[str, tuple[int, int]] = {}
            for player in frame.get("players", []):
                if player.get("x") is None or player.get("y") is None:
                    continue
                point = (player["x"], player["y"])
                current[player["pid"]] = point
                yield player.get("place"), point, previous.get(player["pid"])
            previous = current


@dataclass
class MapView:
    map_name: str
    cell: int
    min_x: float
    max_y: float
    scale: float
    off_x: float
    off_y: float
    cells: set[tuple[int, int]] = field(default_factory=set)
    places: list[tuple[str, float, float, int]] = field(default_factory=list)  # (name, wx, wy, samples)

    def point(self, x: float, y: float) -> tuple[float, float]:
        """World (x, y) to viewBox coordinates; north (world +Y) is up."""
        return self.off_x + (x - self.min_x) * self.scale, self.off_y + (self.max_y - y) * self.scale

    def length(self, units: float) -> float:
        return units * self.scale

    def footprint_path(self) -> str:
        rows: dict[int, list[int]] = {}
        for cx, cy in self.cells:
            rows.setdefault(cy, []).append(cx)
        parts: list[str] = []
        size = self.cell * self.scale
        for cy in sorted(rows, reverse=True):  # top of the screen first
            xs = sorted(rows[cy])
            start = prev = xs[0]
            for cx in xs[1:] + [None]:  # type: ignore[list-item]
                if cx is not None and cx == prev + 1:
                    prev = cx
                    continue
                sx, sy = self.point(start * self.cell, (cy + 1) * self.cell)
                parts.append(f"M{fmt(sx)} {fmt(sy)}h{fmt((prev - start + 1) * size)}v{fmt(size)}h{fmt(-(prev - start + 1) * size)}z")
                if cx is not None:
                    start = prev = cx
        return "".join(parts)

    def place_centroid(self, name: str) -> tuple[float, float] | None:
        for place, wx, wy, _ in self.places:
            if place == name:
                return wx, wy
        return None


def build_map_view(match: dict[str, Any], cell: int = CELL_UNITS) -> MapView:
    cells: set[tuple[int, int]] = set()
    sums: dict[str, list[float]] = {}

    def add(point: tuple[float, float]) -> None:
        cells.add((math.floor(point[0] / cell), math.floor(point[1] / cell)))

    for place, point, previous in _iter_positions(match):
        add(point)
        if place:
            acc = sums.setdefault(place, [0.0, 0.0, 0.0])
            acc[0] += point[0]
            acc[1] += point[1]
            acc[2] += 1
        if previous is not None:
            dx, dy = point[0] - previous[0], point[1] - previous[1]
            distance = math.hypot(dx, dy)
            if 0 < distance <= PATH_STEP_MAX_UNITS:
                steps = int(distance // (cell / 2)) + 1
                for i in range(1, steps):
                    add((previous[0] + dx * i / steps, previous[1] + dy * i / steps))

    # One closing pass: fill single-cell gaps left by coarse sampling.
    candidates: set[tuple[int, int]] = set()
    for cx, cy in cells:
        for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
            if (nx, ny) not in cells:
                candidates.add((nx, ny))
    for cx, cy in sorted(candidates):
        around = sum(((cx + 1, cy) in cells, (cx - 1, cy) in cells, (cx, cy + 1) in cells, (cx, cy - 1) in cells))
        if around >= CLOSING_MIN_NEIGHBOURS:
            cells.add((cx, cy))

    if cells:
        min_cx = min(c[0] for c in cells)
        max_cx = max(c[0] for c in cells)
        min_cy = min(c[1] for c in cells)
        max_cy = max(c[1] for c in cells)
    else:
        min_cx = min_cy = -20
        max_cx = max_cy = 20
    min_x, max_x = min_cx * cell, (max_cx + 1) * cell
    min_y, max_y = min_cy * cell, (max_cy + 1) * cell
    avail_w = VIEW - 2 * MARGIN_X
    avail_h = MAP_BOTTOM - MAP_TOP
    scale = min(avail_w / (max_x - min_x), avail_h / (max_y - min_y))
    off_x = MARGIN_X + (avail_w - (max_x - min_x) * scale) / 2
    off_y = MAP_TOP + (avail_h - (max_y - min_y) * scale) / 2

    total = sum(int(v[2]) for v in sums.values())
    threshold = max(MIN_PLACE_SAMPLES, total // 400)
    places = [
        (name, v[0] / v[2], v[1] / v[2], int(v[2])) for name, v in sorted(sums.items()) if v[2] >= threshold
    ]
    return MapView(str(match.get("map", "")), cell, min_x, max_y, scale, off_x, off_y, cells, places)


# ---------------------------------------------------------------------------
# SVG building blocks
# ---------------------------------------------------------------------------


def _text(x: float, y: float, content: str, size: int = 13, fill: str = PALETTE["ink"], weight: str = "400",
          anchor: str = "start", halo: bool = True) -> str:
    halo_attrs = f' stroke="{PALETTE["bg"]}" stroke-width="3" stroke-linejoin="round" paint-order="stroke"' if halo else ""
    return (
        f'<text x="{fmt(x)}" y="{fmt(y)}" font-size="{size}" font-weight="{weight}" fill="{fill}" '
        f'text-anchor="{anchor}"{halo_attrs}>{escape(content)}</text>'
    )


def _side_label(x: float, y: float, content: str, size: int = 13, fill: str = PALETTE["ink"], weight: str = "700") -> str:
    """Label beside a marker; flips to the left near the right edge so it never clips."""
    width = 0.62 * size * len(content)
    if x + 17 + width > VIEW - 8:
        return _text(x - 17, y + 4.5, content, size, fill, weight, anchor="end")
    return _text(x + 17, y + 4.5, content, size, fill, weight)


def _clock_text(view: dict[str, Any]) -> str:
    clock = view.get("clock") or {}
    bomb = clock.get("bombSecondsLeft")
    left = clock.get("roundSecondsLeft")

    def mmss(seconds: float) -> str:
        whole = max(0, int(round(seconds)))
        return f"{whole // 60}:{whole % 60:02d}"

    if bomb is not None:
        return f"bomb {mmss(bomb)} left"
    if left is not None:
        return f"{mmss(left)} left"
    return "clock n/a"


def _pid_label(pid: str) -> str:
    digits = re.sub(r"\D", "", pid)
    return f"E{int(digits)}" if digits else f"E{pid}"


def _age_label(age: Any) -> str:
    return f"{int(round(float(age)))}s" if isinstance(age, (int, float)) else "?"


def _other(side: str) -> str:
    return "CT" if side == "T" else "T"


def _has_xy(item: dict[str, Any]) -> bool:
    return isinstance(item.get("x"), (int, float)) and isinstance(item.get("y"), (int, float))


def _bomb_position(bomb: dict[str, Any], mv: MapView) -> tuple[float, float] | None:
    if _has_xy(bomb):
        return mv.point(bomb["x"], bomb["y"])
    for name in (bomb.get("place"), f"Bombsite{bomb['site']}" if bomb.get("site") else None):
        if name:
            centre = mv.place_centroid(name)
            if centre:
                return mv.point(*centre)
    return None


def _bomb_marker(x: float, y: float, label: str, ring: str | None = None) -> str:
    half = 9
    extra = f'<rect x="{fmt(x - half - 4)}" y="{fmt(y - half - 4)}" width="{2 * half + 8}" height="{2 * half + 8}" fill="none" stroke="{ring}" stroke-width="2"/>' if ring else ""
    return (
        extra
        + f'<rect x="{fmt(x - half)}" y="{fmt(y - half)}" width="{2 * half}" height="{2 * half}" '
        f'fill="{PALETTE["bomb"]}" stroke="{PALETTE["white"]}" stroke-width="2"/>'
        + _text(x + half + 6, y + 4, label, 12, weight="600")
    )


def _place_labels(mv: MapView) -> str:
    placed: list[tuple[float, float, float, float]] = []
    out: list[str] = []
    for name, wx, wy, _count in sorted(mv.places, key=lambda p: (-p[3], p[0])):
        label = prettify_place(name)
        x, y = mv.point(wx, wy)
        width, height = 6.6 * len(label), 13
        box = (x - width / 2, y - height, x + width / 2, y + 3)
        if any(not (box[2] < b[0] or box[0] > b[2] or box[3] < b[1] or box[1] > b[3]) for b in placed):
            continue
        if box[0] < 4 or box[2] > VIEW - 4:
            continue
        placed.append(box)
        out.append(_text(x, y, label, 11, PALETTE["ink_soft"], anchor="middle"))
    return "".join(sorted(out))


def _legend(unknown: int, groundtruth: bool, own_side: str = "T", y0: int = 896) -> str:
    enemy_side = _other(own_side)
    ink = PALETTE["ink"]
    parts = [f'<line x1="{MARGIN_X}" y1="{y0 - 8}" x2="{VIEW - MARGIN_X}" y2="{y0 - 8}" stroke="{PALETTE["cell"]}" stroke-width="1"/>']
    y1, y2 = y0 + 14, y0 + 44
    x = MARGIN_X
    parts.append(f'<circle cx="{x + 8}" cy="{y1 - 4}" r="8" fill="{PALETTE[own_side]}" stroke="{PALETTE["white"]}" stroke-width="2"/>')
    parts.append(_text(x + 22, y1, "Own team (numbered)", 13, halo=False))
    x = 270
    parts.append(f'<circle cx="{x + 8}" cy="{y1 - 4}" r="8" fill="{PALETTE[enemy_side]}" stroke="{PALETTE["white"]}" stroke-width="2"/>')
    parts.append(_text(x + 22, y1, "Confirmed enemy (filled)", 13, halo=False))
    x = 540
    parts.append(f'<circle cx="{x + 8}" cy="{y1 - 4}" r="8" fill="{PALETTE["white"]}" fill-opacity="0.7" stroke="{PALETTE[enemy_side]}" stroke-width="2.5" stroke-dasharray="4 3"/>')
    parts.append(_text(x + 22, y1, "Last seen (hollow, dashed, age)", 13, halo=False))
    parts.append(_text(MARGIN_X, y2, f"Unknown enemies: {unknown} (not drawn)", 13, halo=False))
    parts.append(f'<rect x="330" y="{y2 - 12}" width="12" height="12" fill="{PALETTE["bomb"]}"/>')
    parts.append(_text(348, y2, "Bomb", 13, halo=False))
    parts.append(f'<circle cx="430" cy="{y2 - 5}" r="8" fill="{PALETTE["smoke_fill"]}" fill-opacity="0.6" stroke="{PALETTE["smoke_stroke"]}" stroke-width="1.5"/>')
    parts.append(_text(444, y2, "Smoke", 13, halo=False))
    parts.append(f'<circle cx="520" cy="{y2 - 5}" r="8" fill="{PALETTE["molotov_fill"]}" fill-opacity="0.6" stroke="{PALETTE["molotov_stroke"]}" stroke-width="1.5"/>')
    parts.append(_text(534, y2, "Molotov", 13, halo=False))
    if groundtruth:
        parts.append(f'<circle cx="640" cy="{y2 - 5}" r="9" fill="{PALETTE[enemy_side]}" stroke="{PALETTE["gt"]}" stroke-width="3"/>')
        parts.append(_text(656, y2, "True position (GT)", 13, halo=False))
    _ = ink
    return "".join(parts)


def _draw_utility(mv: MapView, items: list[dict[str, Any]]) -> str:
    out: list[str] = []
    ordered = sorted(items, key=lambda u: (u.get("kind", ""), u.get("x", 0), u.get("y", 0)))
    for item in ordered:
        if not _has_xy(item):
            continue
        x, y = mv.point(item["x"], item["y"])
        kind = item.get("kind", "")
        age = _age_label(item.get("ageSeconds"))
        if kind == "smoke":
            r = mv.length(SMOKE_RADIUS_UNITS)
            out.append(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{fmt(r)}" fill="{PALETTE["smoke_fill"]}" fill-opacity="0.5" stroke="{PALETTE["smoke_stroke"]}" stroke-width="2"/>')
            out.append(_text(x, y + 4, f"smoke {age}", 11, PALETTE["ink"], "600", "middle"))
        elif kind == "molotov":
            r = mv.length(MOLOTOV_RADIUS_UNITS)
            out.append(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{fmt(r)}" fill="{PALETTE["molotov_fill"]}" fill-opacity="0.5" stroke="{PALETTE["molotov_stroke"]}" stroke-width="2" stroke-dasharray="2 3"/>')
            out.append(_text(x, y + 4, f"molotov {age}", 11, PALETTE["ink"], "600", "middle"))
        else:
            out.append(f'<path d="M{fmt(x)} {fmt(y - 7)}L{fmt(x + 7)} {fmt(y)}L{fmt(x)} {fmt(y + 7)}L{fmt(x - 7)} {fmt(y)}z" fill="none" stroke="{PALETTE["smoke_stroke"]}" stroke-width="2"/>')
            out.append(_text(x + 11, y + 4, f"{kind} {age}", 11, PALETTE["ink_soft"]))
    return "".join(out)


def _draw_known(mv: MapView, view: dict[str, Any], own_side: str) -> tuple[str, int, dict[str, tuple[float, float]]]:
    """Own players, confirmed and last-seen enemies. Returns (svg, unknown count, last-seen screen points by pid)."""
    enemy_side = _other(own_side)
    out: list[str] = []
    own = sorted((p for p in view.get("own", []) if p.get("alive", True) and _has_xy(p)), key=lambda p: p["pid"])
    for index, player in enumerate(own, start=1):
        x, y = mv.point(player["x"], player["y"])
        out.append(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="13" fill="{PALETTE[own_side]}" stroke="{PALETTE["white"]}" stroke-width="2.5"/>')
        out.append(_text(x, y + 4.5, str(index), 13, PALETTE["white"], "700", "middle", halo=False))

    unknown = 0
    last_seen: dict[str, tuple[float, float]] = {}
    for enemy in sorted(view.get("enemies", []), key=lambda e: e["pid"]):
        status = enemy.get("status", "unknown")
        if status == "unknown" or not _has_xy(enemy):
            unknown += 1
            continue
        x, y = mv.point(enemy["x"], enemy["y"])
        label = _pid_label(enemy["pid"])
        if status == "confirmed":
            out.append(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="12" fill="{PALETTE[enemy_side]}" stroke="{PALETTE["white"]}" stroke-width="2.5"/>')
            out.append(_side_label(x, y, label))
        else:
            dash = "5 4" if status == "last_seen" else "2 3"
            out.append(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="12" fill="{PALETTE["white"]}" fill-opacity="0.7" stroke="{PALETTE[enemy_side]}" stroke-width="3" stroke-dasharray="{dash}"/>')
            suffix = _age_label(enemy.get("ageSeconds")) if status == "last_seen" else "inferred"
            out.append(_side_label(x, y, f"{label} {suffix}"))
            last_seen[enemy["pid"]] = (x, y)
    return "".join(out), unknown, last_seen


def _header(mv: MapView, candidate: dict[str, Any], view: dict[str, Any], groundtruth: bool) -> str:
    own_side = candidate.get("perspective", view.get("perspective", "T"))
    alive = view.get("alive") or {}
    line = (
        f'{mv.map_name or candidate.get("map", "")} · Round {candidate.get("round", "?")} · '
        f'{_clock_text(view)} · {own_side} perspective · '
        f'alive {alive.get("own", "?")} own vs {alive.get("enemy", "?")} enemy'
    )
    parts = [_text(MARGIN_X, 44, line, 22, weight="700", halo=False)]
    if groundtruth:
        parts.append(f'<rect x="{MARGIN_X}" y="58" width="44" height="26" rx="4" fill="{PALETTE["gt"]}"/>')
        parts.append(_text(MARGIN_X + 22, 77, "GT", 16, PALETTE["white"], "700", "middle", halo=False))
        parts.append(_text(MARGIN_X + 56, 77, GROUND_TRUTH_BANNER, 16, PALETTE["gt"], "700", halo=False))
    else:
        parts.append(_text(MARGIN_X, 77, "What the team knows at the decision point", 16, PALETTE["ink_soft"], halo=False))
    return "".join(parts)


def _compose(mv: MapView, candidate: dict[str, Any], groundtruth: bool) -> str:
    view = candidate["playerKnown"]
    own_side = candidate.get("perspective", view.get("perspective", "T"))
    enemy_side = _other(own_side)
    known_svg, unknown, last_seen = _draw_known(mv, view, own_side)

    # Bomb
    bomb_svg = ""
    bomb_known = view.get("bomb") or {}
    truth_bomb = (candidate.get("groundTruth") or {}).get("bomb") or {}
    known_pos = _bomb_position(bomb_known, mv)
    if known_pos:
        bomb_svg = _bomb_marker(*known_pos, f"Bomb {bomb_known.get('status', '')}".strip())
    if groundtruth:
        true_pos = _bomb_position(truth_bomb, mv)
        if true_pos and (known_pos is None or (abs(true_pos[0] - known_pos[0]) + abs(true_pos[1] - known_pos[1])) > 1):
            bomb_svg += _bomb_marker(*true_pos, f"Bomb {truth_bomb.get('status', '')} (true)".strip(), ring=PALETTE["gt"])

    truth_svg = ""
    lines_svg = ""
    truth_places: list[str] = []
    if groundtruth:
        line_parts: list[str] = []
        truth_parts: list[str] = []
        known_by_pid = {e["pid"]: e for e in view.get("enemies", [])}
        for enemy in sorted((e for e in (candidate.get("groundTruth") or {}).get("enemies", []) if e.get("alive", True) and _has_xy(e)), key=lambda e: e["pid"]):
            x, y = mv.point(enemy["x"], enemy["y"])
            known = known_by_pid.get(enemy["pid"], {})
            status = known.get("status", "unknown")
            if enemy["pid"] in last_seen:
                lx, ly = last_seen[enemy["pid"]]
                line_parts.append(f'<line x1="{fmt(lx)}" y1="{fmt(ly)}" x2="{fmt(x)}" y2="{fmt(y)}" stroke="{PALETTE[enemy_side]}" stroke-opacity="0.45" stroke-width="2" stroke-dasharray="6 5"/>')
            if status == "confirmed" and _has_xy(known):
                kx, ky = mv.point(known["x"], known["y"])
                if abs(kx - x) + abs(ky - y) <= 1:
                    continue  # already drawn as the confirmed marker
            truth_parts.append(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="11" fill="{PALETTE[enemy_side]}" stroke="{PALETTE["gt"]}" stroke-width="3"/>')
            place = f" · {prettify_place(enemy['place'])}" if enemy.get("place") else ""
            truth_parts.append(_side_label(x, y, f"{_pid_label(enemy['pid'])} GT ({status}){place}", 12, PALETTE["gt"]))
            if enemy.get("place"):
                truth_places.append(f"{_pid_label(enemy['pid'])} at {prettify_place(enemy['place'])}")
        lines_svg = "".join(line_parts)
        truth_svg = "".join(truth_parts)

    alive = view.get("alive") or {}
    kind = "Ground truth (reviewer only)" if groundtruth else "Player-known view"
    title = f"{kind}: {mv.map_name}, round {candidate.get('round', '?')}, {own_side} perspective"
    desc = (
        f"Abstract tactical diagram. Map footprint derived from sampled positions. Clock {_clock_text(view)}. "
        f"{alive.get('own', '?')} own players alive, {alive.get('enemy', '?')} enemies alive; "
        f"{sum(1 for e in view.get('enemies', []) if e.get('status') == 'confirmed')} confirmed, "
        f"{len(last_seen)} last seen, {unknown} unknown and not drawn."
    )
    if groundtruth:
        desc += " Reviewer only: true enemy positions are drawn and must never be shown to players."
        if truth_places:
            desc += " True places: " + "; ".join(truth_places) + "."
    tid, did = ("gt-title", "gt-desc") if groundtruth else ("pk-title", "pk-desc")

    body = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VIEW} {VIEW}" width="{VIEW}" height="{VIEW}" '
        f'role="img" aria-labelledby="{tid} {did}" font-family={quoteattr(FONT)}>',
        f'<title id="{tid}">{escape(title)}</title>',
        f'<desc id="{did}">{escape(desc)}</desc>',
        f'<rect width="{VIEW}" height="{VIEW}" fill="{PALETTE["bg"]}"/>',
        f'<path d="{mv.footprint_path()}" fill="{PALETTE["cell"]}" stroke="{PALETTE["cell"]}" stroke-width="0.6"/>',
        _place_labels(mv),
        _draw_utility(mv, list(view.get("utilityObserved", []))),
        lines_svg,
        bomb_svg,
        known_svg,
        truth_svg,
        _header(mv, candidate, view, groundtruth),
        _legend(unknown, groundtruth, own_side),
        "</svg>",
    ]
    return "\n".join(part for part in body if part) + "\n"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def render_candidate(candidate: dict[str, Any], match: dict[str, Any], view: MapView | None = None) -> dict[str, str]:
    """Return {"playerKnown": svg, "groundTruth": svg}. Pass `view` to reuse one MapView across candidates."""
    mv = view or build_map_view(match)
    return {
        "playerKnown": _compose(mv, candidate, groundtruth=False),
        "groundTruth": _compose(mv, candidate, groundtruth=True),
    }


def render_to_dir(candidate: dict[str, Any], match: dict[str, Any], out_dir: Path, view: MapView | None = None) -> list[Path]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    svgs = render_candidate(candidate, match, view)
    written: list[Path] = []
    for key, name in (("playerKnown", "player-known.svg"), ("groundTruth", "ground-truth.svg")):
        path = out_dir / name
        path.write_text(svgs[key], encoding="utf-8")
        written.append(path)
    return written


def render_footprint(match: dict[str, Any]) -> str:
    """Footprint and place labels only (used to tune the silhouette)."""
    mv = build_map_view(match)
    return "\n".join(
        [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VIEW} {VIEW}" width="{VIEW}" height="{VIEW}" font-family={quoteattr(FONT)}>',
            f'<title>Map footprint: {escape(mv.map_name)}</title>',
            f'<rect width="{VIEW}" height="{VIEW}" fill="{PALETTE["bg"]}"/>',
            f'<path d="{mv.footprint_path()}" fill="{PALETTE["cell"]}" stroke="{PALETTE["cell"]}" stroke-width="0.6"/>',
            _place_labels(mv),
            "</svg>",
        ]
    ) + "\n"
