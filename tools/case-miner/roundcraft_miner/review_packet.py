"""Human tactical-review packets: one compact folder per case under content/review/<case-id>/.

A packet lets a knowledgeable CS2 player review a draft in 5–10 minutes without opening the demo:
the player-known state, the recent timeline, the proposed options and how they score, the follow-up,
what happened in the source round (the reveal, not the answer), the open assumptions, and the
specific questions only a human reviewer should answer.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

from . import paths
from .draft.timeline import anonymise
from .model import read_json

PACKETS_DIR = paths.REPO_ROOT / "content" / "review"
QUESTIONS_FILE = PACKETS_DIR / "questions.json"
_PID = re.compile(r"\bp\d{2}\b")


def _candidate_for(case: dict[str, Any]) -> tuple[Path, dict[str, Any]]:
    match = re.search(r"cand_[0-9a-f]{12}", json.dumps(case["editorial"].get("references", [])))
    if not match:
        raise SystemExit(f"{case['caseId']} has no mined candidate reference")
    found = sorted(paths.data_root().glob(f"candidates/*/{match.group(0)}/candidate.json"))
    if not found:
        raise SystemExit(f"Candidate {match.group(0)} is not available locally; run roundcraft-miner run <source>")
    return found[0], read_json(found[0])


def _identity_free(text: str) -> str:
    """Timelines use anonymised pids; a reviewer only needs the side and readable weapon names."""
    text = re.sub(r"an unattributed source killed (.+?) with world", r"\1 died from world damage", text)
    text = text.replace(" in an unnamed area", "")
    text = re.sub(r"\ba he\b", "an HE grenade", text)
    return anonymise(text)


def _quality(main_cell: dict[str, Any], dims: list[dict[str, Any]]) -> float:
    return sum(main_cell["ratings"][d["id"]] * d["weight"] for d in dims) / 4


def _score_summary(case_id: str) -> str:
    result = subprocess.run(
        ["npm", "run", "--silent", "content:score", "--", case_id],
        cwd=paths.REPO_ROOT, capture_output=True, text=True, check=False,
    )
    return result.stdout.strip() if result.returncode == 0 else f"(content:score failed: {result.stderr.strip()[:200]})"


def _timeline(events: list[Any], start: float) -> list[str]:
    lines = []
    for event in events:
        if isinstance(event, str):
            lines.append(f"- {_identity_free(event)}")
            continue
        when = event.get("t")
        desc = event.get("description") or event.get("type", "")
        prefix = f"{when - start:+.1f} s" if isinstance(when, (int, float)) else ""
        lines.append(f"- `{prefix}` {_identity_free(str(desc))}")
    return lines


def build_packet(case_id: str, questions: dict[str, Any]) -> Path:
    case_path = paths.cases_dir() / f"{case_id}.json"
    case = read_json(case_path)
    candidate_path, candidate = _candidate_for(case)
    brief, followup, reveal, rubric = case["brief"], case["followup"], case["reveal"], case["rubric"]
    q = {item["id"]: item["label"] for item in brief["qualifiers"]}
    actions = {a["id"]: a["label"] for a in brief["actions"]}
    dims = rubric["dimensions"]
    entry = questions.get(case_id, {})
    fu = candidate.get("followUp") or {}
    decision_t = candidate["decisionT"]

    out_dir = PACKETS_DIR / case_id
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in ("player-known.svg", "ground-truth.svg"):
        source = candidate_path.parent / name
        if source.exists():
            shutil.copyfile(source, out_dir / name)

    score = _score_summary(case_id)
    main_rows = sorted(((_quality(m, dims), m) for m in rubric["main"]), key=lambda item: -item[0])
    lines: list[str] = [
        f"# Review packet: {brief['title']}",
        "",
        f"`{case_id}` · {candidate['map']} · {candidate['perspective']} side · status **{case['editorial']['status']}** · "
        f"recommendation **{entry.get('recommendation', 'REVIEW')}**",
        "",
        "Demo-grounded synthetic draft. Options, debrief and rubric are proposals generated from the source "
        "round; nothing here has had human tactical review. Time budget: 5–10 minutes.",
        "",
        f"Play it locally: `npm run content:preview -- {case_id}` then `npm run dev` and open Today.",
        "",
    ]
    if entry.get("summary"):
        lines += ["## Why this case", "", entry["summary"], ""]
    lines += [
        "## Tactical snapshot",
        "",
        "| Player-known view (what the brief may use) | Ground truth (reviewer only, never shown to players) |",
        "| --- | --- |",
        "| ![player-known](player-known.svg) | ![ground truth](ground-truth.svg) |",
        "",
        "## Brief as the player sees it",
        "",
        *[f"- **{f['status'].replace('_', ' ')}** — {f['text']}" for f in brief["facts"]],
        "",
        f"Evidence options (pick two): {' · '.join(e['label'] for e in brief['evidence'])}",
        "",
        "## Recent timeline before the decision (source round)",
        "",
        *(_timeline(candidate["groundTruth"].get("timelineBefore", []), decision_t) or ["- (nothing in the last 20 s)"]),
        "",
        "## Proposed lines and scoring (proposal, not truth)",
        "",
        "| Action | Qualifier | Main-call quality (0–100) |",
        "| --- | --- | --- |",
        *[f"| {actions[m['actionId']]} | {q[m['qualifierId']]} | {value:.0f} |" for value, m in main_rows],
        "",
        "Every combination scored with the production 50/20/30 model:",
        "",
        "```",
        score,
        "```",
        "",
        "## Follow-up",
        "",
        f"{followup.get('heading', '')}: {followup.get('stimulus', '')}",
        "",
        *[f"- **{u['status']}** — {u['text']}" for u in followup.get("updates", [])],
        "",
        "Responses and proposed follow-up quality: "
        + "; ".join(
            f"{next((r['label'] for r in followup.get('responses', []) if r['id'] == cell['responseId']), cell['responseId'])} = {cell['quality']}"
            for cell in sorted(rubric["followup"].get("responses", []), key=lambda c: -c["quality"])
        ),
        "",
    ]
    flags = []
    if fu.get("dependsOnOwnMovement"):
        flags.append("The new information exists because the source team moved; a team on another line would not see it now.")
    if isinstance(fu.get("reactionWindowSeconds"), (int, float)) and fu["reactionWindowSeconds"] < 2:
        flags.append(f"The next kill follows {fu['reactionWindowSeconds']:.1f} s after the new information.")
    if not candidate.get("followUp"):
        flags.append("No independent follow-up exists in the source round; the follow-up shown is a placeholder to author.")
    if flags:
        lines += ["Follow-up caveats:", "", *[f"- {flag}" for flag in flags], ""]
    lines += [
        "## What happened in the source round (reveal, not the answer key)",
        "",
        reveal["comparison"]["roundAction"],
        "",
        *_timeline(candidate["groundTruth"].get("timelineAfter", []), decision_t),
        "",
        f"What to remember (proposed): {reveal['principle']}",
        "",
        "## Assumptions that need judgement",
        "",
        *[f"- {issue}" for issue in entry.get("assumptions", [])],
        *[f"- {issue}" for issue in case["editorial"].get("knownIssues", []) if "placeholder" not in issue.lower()][:8],
        "",
        "## Questions for the reviewer",
        "",
        *[f"{i}. {question}" for i, question in enumerate(entry.get("questions", []), start=1)],
        "",
        "## Your verdict",
        "",
        "Answer the questions above in a sentence each, then record the review in the case file:",
        "",
        "```json",
        '"reviewers": [{ "name": "<your name>", "reviewedAt": "YYYY-MM-DD", "verdict": "approved | changes_requested", "notes": "<answers and required edits>" }]',
        "```",
        "",
        "Only a named human CS2 reviewer can approve. `approved` plus `status: \"tactically_reviewed\"` is the "
        "next step; `changes_requested` keeps it as a draft.",
        "",
    ]
    text = "\n".join(lines)
    # The score summary is ours (percentiles such as p25 look like pids); every other line derives from the demo.
    if _PID.search(text.replace(score, "")) or re.search(r"\b7656119\d{10}\b", text):
        raise SystemExit(f"Refusing to write {case_id}: identity-like token in packet text")
    packet = out_dir / "README.md"
    packet.write_text(text, encoding="utf-8")
    return packet


def build_packets(case_ids: list[str] | None = None) -> list[Path]:
    questions = read_json(QUESTIONS_FILE) if QUESTIONS_FILE.exists() else {}
    ids = case_ids or sorted(questions)
    return [build_packet(case_id, questions) for case_id in ids]
