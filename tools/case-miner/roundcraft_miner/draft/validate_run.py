"""Run the repository's content validator on one generated draft and parse its report."""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path
from typing import Any

from .. import paths

_ISSUE = re.compile(r"^\s+(error|warn)\s+\[([A-Za-z0-9_]+)\]\s+(.*)$")
_HEAD = re.compile(r"^(PASS|FAIL|DRAFT)\s+(\S+)\s+(.*)$")
_TIMEOUT_SECONDS = 180

_NODE_RUNNER = (
    "import { runValidate } from './scripts/content/validate.ts';"
    "process.exitCode = runValidate(['--case', process.env.RC_CASE], process.env.RC_ROOT);"
)


def _uses_repo_cases(case_path: Path) -> bool:
    try:
        return case_path.resolve().parent == paths.cases_dir().resolve()
    except OSError:
        return False


def parse_validator_output(stdout: str) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    state = None
    publishable = False
    for line in stdout.splitlines():
        head = _HEAD.match(line)
        if head:
            state = head.group(1)
            publishable = "publishable=yes" in head.group(3)
            continue
        issue = _ISSUE.match(line)
        if issue:
            (errors if issue.group(1) == "error" else warnings).append(f"[{issue.group(2)}] {issue.group(3)}")
    return {"state": state, "errors": errors, "warnings": warnings, "publishable": publishable}


def run_validator(case_id: str, case_path: Path) -> dict[str, Any]:
    """`npm run --silent content:validate -- --case <id>` from the repo root.

    When the draft was written outside the repository's content/cases (tests use a temp dir shaped
    <root>/content/cases), the same validator entry point is invoked with that root instead, so the
    repository is never touched. The validator itself is never modified or bypassed."""
    root = paths.REPO_ROOT
    env = dict(os.environ)
    if _uses_repo_cases(case_path):
        cmd = ["npm", "run", "--silent", "content:validate", "--", "--case", case_id]
    else:
        env["RC_CASE"] = case_id
        env["RC_ROOT"] = str(case_path.resolve().parent.parent.parent)
        cmd = ["node", "--no-warnings=ExperimentalWarning", "--import", "./scripts/content/register.mjs",
               "--input-type=module", "-e", _NODE_RUNNER]
    report: dict[str, Any] = {"caseId": case_id, "path": str(case_path), "validatorExitCode": None,
                              "errors": [], "warnings": [], "publishable": False, "validated": False}
    try:
        proc = subprocess.run(cmd, cwd=root, env=env, capture_output=True, text=True, timeout=_TIMEOUT_SECONDS)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        report["errors"] = [f"[validator_not_run] {exc}"]
        return report
    parsed = parse_validator_output(proc.stdout)
    report.update({
        "validatorExitCode": proc.returncode,
        "errors": parsed["errors"],
        "warnings": parsed["warnings"],
        "publishable": parsed["publishable"],
        "validated": True,
        "state": parsed["state"],
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    })
    if proc.returncode not in (0, 1) or (parsed["state"] is None and proc.returncode != 0):
        report["errors"].append(f"[validator_failed] exit code {proc.returncode}: {proc.stderr.strip()[:500]}")
    return report
