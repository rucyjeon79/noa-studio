#!/usr/bin/env python3
"""Fail closed on unauthorized NOA scheduled work (does not access the host)."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"
CONFIG = ROOT / "config" / "n80-approved-schedules.json"
CRON = re.compile(r"(?m)^\s*-\s*cron:\s*['\"]?([^'\"\n#]+)")
WAKE_MODE = "signed_n80_wake_only"


def audit():
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    if config.get("version") != 1 or not isinstance(config.get("approved"), list):
        raise ValueError("invalid_schedule_allowlist")
    approved = {}
    for row in config["approved"]:
        if not isinstance(row, dict):
            raise ValueError("invalid_schedule_entry")
        workflow = row.get("workflow")
        cron = row.get("cron")
        approval = row.get("ownerActionReference")
        if (not isinstance(workflow, str) or not re.fullmatch(r"n80-[a-z0-9-]+\.yml", workflow)
                or not isinstance(cron, str) or not cron.strip()
                or not isinstance(approval, str) or not approval.strip()
                or row.get("mode") != WAKE_MODE
                or row.get("githubBusinessWorkAllowed") is not False):
            raise ValueError("unapproved_schedule_entry")
        if workflow in approved:
            raise ValueError("duplicate_schedule_entry")
        approved[workflow] = cron.strip()
    seen, bad, checked = set(), [], 0
    for path in sorted(WORKFLOWS.glob("*.y*ml")):
        if path.name.startswith("busan-"):
            continue  # Separate project, not governed by NOA policy.
        checked += 1
        text = path.read_text(encoding="utf-8")
        # Ignore YAML comments, not workflow definitions.
        text = "\n".join(line for line in text.splitlines()
                         if not line.lstrip().startswith("#"))
        expressions = [x.strip() for x in CRON.findall(text)]
        if expressions:
            seen.add(path.name)
        if not expressions and path.name in approved:
            bad.append(f"{path.name}: approved_cron_not_configured")
        if expressions != ([approved[path.name]] if path.name in approved else []):
            if expressions:
                bad.append(f"{path.name}: cron_without_matching_owner_approval={expressions}")
    # Never silently reintroduce legacy GitHub jobs that install or restart
    # a resident Node process. Old code is retained in Git history only.
    for name in ("n80-hub-bootstrap.yml", "n80-engine-facade-production.yml"):
        path = WORKFLOWS / name
        body = path.read_text(encoding="utf-8")
        if (("if: ${{ false }}" not in body or
             "hub" not in body.lower() or
             any(word in body for word in ("NOA_SSH_HOST", "N80_HUB_INSTALL",
                                           "scripts/n80_hub_bootstrap.py",
                                           "scripts/n80_single_session_deploy.py"))):
            bad.append(f"{name}: legacy_host_deployment_not_retired")
    launch = (ROOT / "runtime/hub/launch.mjs").read_text(encoding="utf-8")
    runner = (ROOT / "runtime/hub/runner.mjs").read_text(encoding="utf-8")
    bootstrap = (ROOT / "scripts/n80_hub_bootstrap.py").read_text(encoding="utf-8")
    hub = (ROOT / "deploy/noa-app/engine/hub.php").read_text(encoding="utf-8")
    if ("hub_resident_runner_retired" not in launch or
            "hub_resident_runner_retired" not in runner or
            "hub_resident_runner_retired" not in bootstrap or
            "hub_resident_runner_retired" not in hub or
            "spawn(" in launch or "proc_open(" in hub or
            "while(" in runner or "transport.open_session" in bootstrap):
        bad.append("resident_n80_execution_reintroduced")
    missing = sorted(set(approved) - seen)
    if missing:
        bad.extend(f"{name}: approved_wake_missing" for name in missing)
    result = {"checked": checked, "approved": len(approved),
              "violations": bad, "hostWrites": 0, "businessDispatches": 0}
    print("N80_SCHEDULE_OWNER_GUARD " + json.dumps(result, ensure_ascii=False))
    return 1 if bad else 0


if __name__ == "__main__":
    try:
        sys.exit(audit())
    except Exception as exc:
        print("N80_SCHEDULE_OWNER_GUARD_BLOCK " + type(exc).__name__ + ": " + str(exc))
        sys.exit(1)
