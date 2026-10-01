"""Human tactical-review packets: one compact folder per case under content/review/<case-id>/.

A packet lets a knowledgeable CS2 player review a draft in 5–10 minutes without opening the demo or the
case JSON. It has seven sections: the situation, what the deciding team knew, the main decision and how
it is scored, the follow-up and its action-aware score matrix, what happened in the source round
(descriptive only), the questions only a reviewer can answer, and an approval form.

Everything is derived from the case file, its mined candidate and content/review/questions.json; the
packet never changes a score.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

from . import paths
from .draft.text import map_display
from .draft.timeline import anonymise
from .model import read_json

PACKETS_DIR = paths.REPO_ROOT / "content" / "review"
QUESTIONS_FILE = PACKETS_DIR / "questions.json"
_PID = re.compile(r"\bp\d{2}\b")
_TIER_LINE = re.compile(r"^action (\w+) -> tier (\w+) \((.*?)\)(?:; caps .*)?$")

# Situation rows: (label, fact id prefixes) in display order.
_SITUATION_ROWS = (
    ("Score and match context", ("score", "pistol_round")),
    ("Time", ("clock",)),
    ("Alive", ("alive_",)),
    ("Weapons and armour", ("own_loadout",)),
    ("Utility and defuse kits", ("own_utility", "defuse_kits")),
    ("Bomb", ("bomb_",)),
    ("Your positions", ("own_positions",)),
)


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
    raw = sum(main_cell["ratings"][d["id"]] * d["weight"] for d in dims) / 4
    return min([raw, *main_cell.get("caps", [])])


def _stress_lines(case_id: str) -> list[str]:
    """The named stress lines from `npm run content:score` (production scoring code)."""
    result = subprocess.run(
        ["npm", "run", "--silent", "content:score", "--", case_id],
        cwd=paths.REPO_ROOT, capture_output=True, text=True, check=False,
    )
    if result.returncode != 0:
        return [f"(content:score failed: {result.stderr.strip()[:200]})"]
    out = result.stdout
    if "Stress lines:" not in out:
        return []
    block = out.split("Stress lines:", 1)[1].split("Follow-up checks:", 1)[0]
    return [line.rstrip() for line in block.strip("\n").splitlines() if line.strip()]


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


def _tier_reasons(case: dict[str, Any]) -> dict[str, tuple[str, str]]:
    """Proposed tier and the rule behind it for each action, read from the draft's prior table."""
    reasons: dict[str, tuple[str, str]] = {}
    for line in str(case["editorial"].get("notes", "")).splitlines():
        match = _TIER_LINE.match(line.strip())
        if match and match.group(1) not in reasons:
            reasons[match.group(1)] = (match.group(2), match.group(3).replace("NORMALISED", "promoted"))
    return reasons


def _fact_text(facts: list[dict[str, Any]], prefixes: tuple[str, ...]) -> str:
    texts = [f["text"] for f in facts if any(f["id"] == p or f["id"].startswith(p) for p in prefixes)]
    return " ".join(texts) if texts else "Not stated in the brief."


def _time_text(facts: list[dict[str, Any]], candidate: dict[str, Any]) -> str:
    clock = (candidate.get("playerKnown") or {}).get("clock") or {}
    if any(f["id"] == "clock" for f in facts):
        return _fact_text(facts, ("clock",))
    if isinstance(clock.get("bombSecondsLeft"), (int, float)):
        return f"{clock['bombSecondsLeft']:.0f} s left on the bomb timer (once planted, the round clock no longer applies)."
    return "Not stated in the brief."


def _situation(case: dict[str, Any], candidate: dict[str, Any]) -> list[str]:
    facts = case["brief"]["facts"]
    rows = [
        ("Map", map_display(str(candidate.get("map", "")))),
        ("Side", f"{candidate.get('perspective')} ({'defenders' if candidate.get('perspective') == 'CT' else 'attackers'})"),
        *((label, _time_text(facts, candidate) if label == "Time" else _fact_text(facts, prefixes))
          for label, prefixes in _SITUATION_ROWS),
    ]
    return ["| | |", "| --- | --- |", *[f"| {label} | {value} |" for label, value in rows]]


def _player_known(case: dict[str, Any]) -> list[str]:
    situation_prefixes = tuple(p for _, prefixes in _SITUATION_ROWS for p in prefixes) + ("perspective",)
    facts = [f for f in case["brief"]["facts"]
             if not any(f["id"] == p or f["id"].startswith(p) for p in situation_prefixes)]
    lines: list[str] = []
    for status, heading in (("confirmed", "Confirmed"), ("last_seen", "Last seen (with age)"),
                            ("inferred", "Inferred"), ("unknown", "Unknown")):
        items = [f["text"] for f in case["brief"]["facts"] if f["status"] == status and (status != "confirmed" or f in facts)]
        lines.append(f"**{heading}**")
        empty = "- Nothing beyond the situation table above." if status == "confirmed" else "- None."
        lines += [f"- {text}" for text in items] or [empty]
        lines.append("")
    return lines


def _main_decision(case: dict[str, Any]) -> list[str]:
    brief, rubric = case["brief"], case["rubric"]
    dims = rubric["dimensions"]
    q_labels = {q["id"]: q["label"] for q in brief["qualifiers"]}
    e_labels = {e["id"]: e["label"] for e in brief["evidence"]}
    tiers = _tier_reasons(case)
    quality = {(m["actionId"], m["qualifierId"]): _quality(m, dims) for m in rubric["main"]}
    best = {a["id"]: max(quality[(a["id"], q)] for q in a["qualifierIds"]) for a in brief["actions"]}
    ordered = sorted(brief["actions"], key=lambda a: -best[a["id"]])

    lines = [
        "The player picks one action, one way to execute it and a confidence level (confidence is never scored).",
        "",
        "| Action | Ways to execute it (proposed main-call quality, 0–100) | Proposed tier: the rule behind it |",
        "| --- | --- | --- |",
    ]
    for action in ordered:
        execs = "; ".join(f"{q_labels[q]} ({quality[(action['id'], q)]:.0f})"
                          for q in sorted(action["qualifierIds"], key=lambda q: -quality[(action["id"], q)]))
        tier, reason = tiers.get(action["id"], ("—", "not recorded"))
        lines.append(f"| {action['label']} | {execs} | {tier}: {reason} |")
    dim_text = " and ".join(f"{d['id'].replace('_', ' ')} ({d['weight']}%)" for d in dims)
    lines += [
        "",
        "**How the main call and evidence score**",
        "",
        f"- Main call, up to 50 points: half the line's quality above. Each line is rated on {dim_text}.",
        "- Evidence, up to 20 points: the player picks two of "
        + ", ".join(f"\"{e['label']}\"" for e in brief["evidence"])
        + ". Each pair has proposed points for each action:",
        "",
        "| Action | Highest-scoring pairs | Lowest-scoring pair |",
        "| --- | --- | --- |",
    ]
    for action in ordered:
        cells = sorted((c for c in rubric["evidence"] if c["actionId"] == action["id"]), key=lambda c: -c["points"])
        pair = lambda c: " + ".join(e_labels[i] for i in c["evidenceIds"])  # noqa: E731
        top = "; ".join(f"{pair(c)} ({c['points']})" for c in cells[:2])
        low = f"{pair(cells[-1])} ({cells[-1]['points']})" if cells else "—"
        lines.append(f"| {action['label']} | {top} | {low} |")
    defensible = [a for a in ordered if best[a["id"]] >= 70]
    lines += ["", "**Why more than one line may be defensible**", ""]
    if len(defensible) >= 2:
        lines += [f"- {a['label']} (best line {best[a['id']]:.0f}): {tiers.get(a['id'], ('', 'no rule recorded'))[1]}."
                  for a in defensible]
    else:
        lines.append("- Only one action reaches a defensible line (70 or more) under the draft's rules; check whether that is right.")
    alt = case["reveal"]["debrief"].get("strongestAlternative")
    if alt:
        lines += [f"- The draft's debrief names the strongest alternative: {alt}"]
    return lines + [""]


def _followup(case: dict[str, Any], candidate: dict[str, Any]) -> list[str]:
    followup, rubric, brief = case["followup"], case["rubric"], case["brief"]
    fu = candidate.get("followUp") or {}
    lines = [f"**{followup.get('heading', '')}**: {followup.get('stimulus', '')}", ""]
    lines += [f"- {u['status']}: {u['text']}" for u in followup.get("updates", [])]
    lines += ["", "**Timing**", ""]
    if fu:
        arrives = fu.get("t", 0) - candidate.get("decisionT", 0)
        lines.append(f"- The new information arrives {arrives:.1f} s after the decision.")
        window = fu.get("reactionWindowSeconds")
        if isinstance(window, (int, float)):
            lines.append(f"- Reaction window: the next kill in the source round comes {window:.2f} s after the new information"
                         + (" — almost no time to act on it." if window < 2 else "."))
        else:
            lines.append("- Reaction window: no kill follows the new information in the recorded round.")
        own = fu.get("dependsOnOwnMovement")
        if own is True:
            lines.append("- It depends on the source team's own movement: a team on another line might not have seen it.")
        elif own is False:
            lines.append("- It comes from the opponents, not from the source team's own movement.")
    else:
        lines.append("- No independent new information exists in the source round; this follow-up is the clock running down.")

    responses = followup.get("responses", [])
    cells = {(c["actionId"], c["responseId"]): c["quality"] for c in rubric["followup"].get("responses", [])}
    labels = {a["id"]: a["label"] for a in brief["actions"]}
    lines += [
        "",
        "**Follow-up score matrix** (proposed quality 0–100; worth up to 30 points): rows are the action the player locked, "
        "columns the answer they give now.",
        "",
        "| Locked action | " + " | ".join(r["label"] for r in responses) + " |",
        "| --- |" + " --- |" * len(responses),
    ]
    for action in brief["actions"]:
        lines.append(f"| {labels[action['id']]} | "
                     + " | ".join(str(cells.get((action["id"], r["id"]), "–")) for r in responses) + " |")
    stay = {a["id"]: cells.get((a["id"], f"now_{a['id']}")) for a in brief["actions"]}
    if all(isinstance(v, int) for v in stay.values()):
        dims = rubric["dimensions"]
        best_main = max(rubric["main"], key=lambda m: _quality(m, dims))["actionId"]
        best_now = max(stay, key=lambda i: stay[i])
        verdict = "leaves the strongest line unchanged" if best_now == best_main else "changes the strongest line"
        lines += [
            "",
            f"How the draft built it: each cell is the value of the answer's line after the update, minus a switching cost "
            f"(10 within the same posture, 20 one step apart, 30 between passive and active; nothing for staying). "
            f"Under the draft's rules the update {verdict}: before, {labels[best_main]}; after, {labels[best_now]}.",
        ]
    stress = _stress_lines(case["caseId"])
    if stress:
        lines += ["", "Totals for named lines (best way to execute and best evidence pair for each action):", "", "```", *stress, "```"]
        if any("changes the strongest line" in line for line in lines):
            lines += ["", "The line names describe each action's rank before the update. Here the update changes the "
                      "strongest line, so a switch towards the new strongest line is a correction, not a needless reversal."]
    return lines + [""]


def _what_happened(case: dict[str, Any]) -> list[str]:
    reveal = case["reveal"]
    lines = [
        "> Descriptive only. This is what one team did in one recorded round. It is not the answer key, and the scoring "
        "above was not built from it.",
        "",
        reveal["comparison"]["roundAction"],
        "",
    ]
    for event in reveal.get("continuation", {}).get("events", []):
        lines.append(f"- `{event.get('timestamp', '')}` {event.get('action', '')}")
    lines += ["", f"Takeaway the draft proposes (\"What to remember\"): *{reveal['principle']}*", ""]
    return lines


def _approval_form(case_id: str) -> list[str]:
    def item(question: str, prompt: str = "Changes:") -> list[str]:
        return [f"- **{question}** ☐ Yes ☐ No", f"  {prompt} ______________________", ""]

    return [
        "Copy this section into your reply, or fill it in here. One line per answer is enough.",
        "",
        *item("Are the main options realistic for this moment?"),
        "- **Best-supported line:** ______________________ (agree with the draft's ☐ / different ☐)",
        "",
        "- **Other defensible lines:** ______________________",
        "",
        *item("Is the evidence weighting fair?"),
        *item("Is the follow-up realistic (it could plausibly reach a team on any line)?"),
        *item("Is the follow-up score matrix fair?", "Rows or cells to change:"),
        *item("Are callouts, timings and numbers correct?", "Corrections:"),
        *item("Is the takeaway (\"What to remember\") correct and transferable?", "Rewrite:"),
        "- **Verdict:** ☐ Approve ☐ Changes requested",
        "- **Reviewer name and date:** ______________________",
        "",
        "The case owner records the verdict in the case file, so the reviewer does not need to touch JSON:",
        "",
        "```json",
        f'"reviewers": [{{ "name": "<reviewer>", "reviewedAt": "YYYY-MM-DD", "verdict": "approved | changes_requested", "notes": "<answers above>" }}]',
        "```",
        "",
        f"Only a named human CS2 reviewer can approve. `approved` lets the owner move `{case_id}` to `tactically_reviewed`; "
        "`changes_requested` keeps it a draft.",
        "",
    ]


def build_packet(case_id: str, questions: dict[str, Any]) -> Path:
    case = read_json(paths.cases_dir() / f"{case_id}.json")
    candidate_path, candidate = _candidate_for(case)
    entry = questions.get(case_id, {})

    out_dir = PACKETS_DIR / case_id
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in ("player-known.svg", "ground-truth.svg"):
        source = candidate_path.parent / name
        if source.exists():
            shutil.copyfile(source, out_dir / name)

    lines: list[str] = [
        f"# Review packet: {case['brief']['title']}",
        "",
        f"`{case_id}` · status **{case['editorial']['status']}** · queue: **{entry.get('recommendation', 'REVIEW')}** · "
        "about 5–10 minutes",
        "",
        "A synthetic case built from a decision point in a recorded round. The options, scores and debrief are proposals "
        "from the draft generator; nothing here has had human tactical review. You do not need the demo or the case JSON.",
        "",
        f"To play it locally: `npm run content:preview -- {case_id}`, then `npm run dev`, and open Today.",
        "",
    ]
    if entry.get("summary"):
        lines += ["**In one paragraph.** " + entry["summary"], ""]
    lines += [
        "## 1. Situation",
        "",
        *_situation(case, candidate),
        "",
        "## 2. What the deciding team knew",
        "",
        "| Player-known view (all the brief may use) | Ground truth (reviewer only, never shown to players) |",
        "| --- | --- |",
        "| ![player-known](player-known.svg) | ![ground truth](ground-truth.svg) |",
        "",
        *_player_known(case),
        "<details><summary>Last 20 s of the source round before the decision (reviewer context, includes events the team could not see)</summary>",
        "",
        *(_timeline(candidate["groundTruth"].get("timelineBefore", []), candidate["decisionT"]) or ["- Nothing recorded."]),
        "",
        "</details>",
        "",
        "## 3. Main decision",
        "",
        *_main_decision(case),
        "## 4. Follow-up",
        "",
        *_followup(case, candidate),
        "## 5. What actually happened",
        "",
        *_what_happened(case),
        "## 6. Questions for the reviewer",
        "",
        *[f"{i}. {question}" for i, question in enumerate(entry.get("questions", []), start=1)],
        "",
        "Assumptions the draft makes that you may want to challenge:",
        "",
        *[f"- {item}" for item in entry.get("assumptions", [])],
        "",
        "## 7. Approval form",
        "",
        *_approval_form(case_id),
    ]
    text = "\n".join(lines)
    # Percentiles and other tool output can look like pids; only demo-derived text must be identity-free.
    if _PID.search(re.sub(r"```.*?```", "", text, flags=re.S)) or re.search(r"\b7656119\d{10}\b", text):
        raise SystemExit(f"Refusing to write {case_id}: identity-like token in packet text")
    packet = out_dir / "README.md"
    packet.write_text(text, encoding="utf-8")
    return packet


def build_packets(case_ids: list[str] | None = None) -> list[Path]:
    questions = read_json(QUESTIONS_FILE) if QUESTIONS_FILE.exists() else {}
    ids = case_ids or sorted(questions)
    return [build_packet(case_id, questions) for case_id in ids]
