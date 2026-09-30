"""roundcraft-miner: offline CLI from demo file to Roundcraft case draft.

    roundcraft-miner source add <demo.dem> --id src_xxx --metadata meta.json
    roundcraft-miner source list
    roundcraft-miner parse <source-id>
    roundcraft-miner mine <source-id> [--min-score 0.5]
    roundcraft-miner run <source-id>                       parse + mine + render
    roundcraft-miner candidates list [--map de_mirage] [--min-score 0.6] [--category post_plant] [--limit 20]
    roundcraft-miner candidate show <candidate-id>
    roundcraft-miner candidate render <candidate-id>
    roundcraft-miner case draft <candidate-id> [--case-id case_x] [--overwrite] [--no-validate]

Nothing here publishes anything. Drafts land in content/cases/ with status "draft"
and go through the normal content pipeline (validate → human review → build).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import paths
from .model import read_json


def _find_candidate(candidate_id: str) -> Path:
    matches = sorted(paths.data_root().glob(f"candidates/*/{candidate_id}/candidate.json"))
    if not matches:
        raise SystemExit(f"Candidate {candidate_id} not found under {paths.data_root() / 'candidates'}")
    return matches[0]


def _load_match_for(candidate: dict) -> dict:
    match_path = paths.parsed_dir(candidate["sourceId"]) / "match.json"
    if not match_path.exists():
        raise SystemExit(f"Parsed match missing: {match_path}. Run: roundcraft-miner parse {candidate['sourceId']}")
    return read_json(match_path)


def cmd_source_add(args: argparse.Namespace) -> int:
    from .sources.local import add_local_demo

    meta = read_json(Path(args.metadata))
    manifest = add_local_demo(
        Path(args.path),
        source_id=args.id,
        acquisition=meta["acquisition"],
        match=meta["match"],
        licence=meta["licence"],
        content_lane=meta["contentLane"],
        provenance_note=meta["provenanceNote"],
    )
    print(f"Registered {manifest['sourceId']} ({manifest['demo']['mapName']}, sha256 {manifest['demo']['sha256'][:12]}…)")
    return 0


def cmd_source_list(_: argparse.Namespace) -> int:
    for path in sorted(paths.manifests_dir().glob("src_*.json")):
        manifest = read_json(path)
        demo = manifest["demo"]
        local = paths.demos_dir() / demo["localFilename"]
        state = "present" if local.exists() else "missing locally"
        print(f"{manifest['sourceId']:<40} {demo['mapName']:<12} {manifest['rights']['contentLane']:<22} demo {state}")
    return 0


def cmd_parse(args: argparse.Namespace) -> int:
    from .parse.normalise import parse_source

    out = parse_source(args.source_id)
    print(f"Wrote {out}")
    return 0


def _render_candidate_file(candidate_path: Path, match: dict | None = None, view: object | None = None) -> list[Path]:
    from .render.svg import render_to_dir

    candidate = read_json(candidate_path)
    return render_to_dir(candidate, match or _load_match_for(candidate), candidate_path.parent, view=view)


def cmd_mine(args: argparse.Namespace) -> int:
    from .mine.pipeline import mine_source

    written = mine_source(args.source_id, min_score=args.min_score)
    print(f"Wrote {len(written)} candidates for {args.source_id}")
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    from .mine.pipeline import mine_source
    from .parse.normalise import parse_source

    match_path = parse_source(args.source_id)
    written = mine_source(args.source_id, min_score=args.min_score)
    from .render.svg import build_map_view

    match = read_json(match_path)
    view = build_map_view(match)
    for candidate_path in written:
        _render_candidate_file(candidate_path, match, view)
    print(f"{args.source_id}: {len(written)} candidates mined and rendered")
    return 0


def cmd_candidates_list(args: argparse.Namespace) -> int:
    from .mine.pipeline import list_candidates

    rows = list_candidates(map_name=args.map, min_score=args.min_score, category=args.category)
    for row in rows[: args.limit]:
        print(
            f"{row['candidateId']}  {row['score']:.2f}  {row.get('map', ''):<11} r{row['round']:<3} "
            f"{row['perspective']:<3} {row['category']:<22} {row['summary']}"
        )
    print(f"{min(len(rows), args.limit)} of {len(rows)} candidates shown")
    return 0


def cmd_candidate_show(args: argparse.Namespace) -> int:
    candidate = read_json(_find_candidate(args.candidate_id))
    # Player-known view only; ground truth is for the reviewer bundle, not the terminal summary.
    view = {key: candidate[key] for key in ("candidateId", "map", "round", "perspective", "category", "summary", "score")}
    view["facts"] = candidate["playerKnown"]["facts"]
    view["followUp"] = candidate["followUp"]["summary"] if candidate.get("followUp") else None
    print(json.dumps(view, indent=2, ensure_ascii=False))
    return 0


def cmd_candidate_render(args: argparse.Namespace) -> int:
    for path in _render_candidate_file(_find_candidate(args.candidate_id)):
        print(f"Wrote {path}")
    return 0


def cmd_case_draft(args: argparse.Namespace) -> int:
    from .draft.case_draft import draft_case

    path, report = draft_case(
        _find_candidate(args.candidate_id),
        case_id=args.case_id,
        validate=not args.no_validate,
        overwrite=args.overwrite,
    )
    print(f"Wrote draft {path}")
    if report:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="roundcraft-miner", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    source = sub.add_parser("source", help="register and list source demos").add_subparsers(dest="action", required=True)
    add = source.add_parser("add", help="register a local demo file with provenance metadata")
    add.add_argument("path")
    add.add_argument("--id", required=True, help="source id, e.g. src_mirage_faceit_2026_10_01")
    add.add_argument("--metadata", required=True, help="JSON file: acquisition, match, licence, contentLane, provenanceNote")
    add.set_defaults(func=cmd_source_add)
    source.add_parser("list", help="list registered sources").set_defaults(func=cmd_source_list)

    parse = sub.add_parser("parse", help="normalise a registered demo into ground-truth rounds")
    parse.add_argument("source_id")
    parse.set_defaults(func=cmd_parse)

    for name, func, help_text in (
        ("mine", cmd_mine, "detect and rank decision candidates"),
        ("run", cmd_run, "parse, mine and render one source"),
    ):
        command = sub.add_parser(name, help=help_text)
        command.add_argument("source_id")
        command.add_argument("--min-score", type=float, default=0.0)
        command.set_defaults(func=func)

    candidates = sub.add_parser("candidates", help="browse mined candidates").add_subparsers(dest="action", required=True)
    listing = candidates.add_parser("list")
    listing.add_argument("--map")
    listing.add_argument("--min-score", type=float, default=0.0)
    listing.add_argument("--category")
    listing.add_argument("--limit", type=int, default=30)
    listing.set_defaults(func=cmd_candidates_list)

    candidate = sub.add_parser("candidate", help="inspect one candidate").add_subparsers(dest="action", required=True)
    for name, func in (("show", cmd_candidate_show), ("render", cmd_candidate_render)):
        command = candidate.add_parser(name)
        command.add_argument("candidate_id")
        command.set_defaults(func=func)

    case = sub.add_parser("case", help="create Roundcraft drafts").add_subparsers(dest="action", required=True)
    draft = case.add_parser("draft", help="generate a draft case from a candidate (status: draft)")
    draft.add_argument("candidate_id")
    draft.add_argument("--case-id")
    draft.add_argument("--overwrite", action="store_true")
    draft.add_argument("--no-validate", action="store_true")
    draft.set_defaults(func=cmd_case_draft)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return int(args.func(args) or 0)


if __name__ == "__main__":
    sys.exit(main())
