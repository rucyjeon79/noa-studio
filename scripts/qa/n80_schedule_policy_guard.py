#!/usr/bin/env python3
"""Fail closed on unauthorized NOA scheduled work (does not access the host)."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"
CONFIG = ROOT / "config" / "n80-approved-schedules.json"
CLEANUP = ROOT / "config" / "n80-github-cleanup.json"
CRON = re.compile(r"(?m)^\s*-\s*cron:\s*['\"]?([^'\"\n#]+)")
WAKE_MODE = "signed_n80_wake_only"

RETIRED_N80_BUSINESS_WORKFLOWS = (
    "noa-jukebox.yml",
    "noa-popularity-hourly.yml",
    "noa-push-dispatch.yml",
    "noa-membership-maintenance.yml",
    "noa-media-retention.yml",
    "noa-suno-card-auto.yml",
    "noa-personal-listening.yml",
    "noa-notifications.yml",
    "noa-cover-fill.yml",
    "noa-recommendation-follow.yml",
    "noa-activity.yml",
)

# Former unattended GitHub/SSH business or deploy jobs may never own DotHome.
RETIRED_HOST_JOBS = [
    ("noa-approved-browse-release.yml", "production"),
    ("noa-approved-ui-release.yml", "production"),
    ("noa-backup-migration-cleanup.yml", "cleanup"),
    ("noa-bloom-publish.yml", "publish"),
    ("noa-catalog.yml", "release"),
    ("noa-engine-catalog.yml", "deploy"),
    ("noa-engine-durable-store-production.yml", "deploy"),
    ("noa-engine-event-contract-production.yml", "deploy"),
    ("noa-engine-inbox-production.yml", "deploy"),
    ("noa-engine-lease-inbox-production.yml", "deploy"),
    ("noa-engine-outbox-production.yml", "deploy"),
    ("noa-engine-router-production.yml", "deploy"),
    ("noa-engine-workflow-production.yml", "deploy"),
    ("noa-full-runtime-release.yml", "runtime"),
    ("noa-initial-catalog-flash.yml", "deploy"),
    ("noa-jukebox-genre.yml", "publish"),
    ("noa-jukebox-upload-css-production.yml", "verify-and-deploy"),
    ("noa-p0-cache-release.yml", "release"),
    ("noa-popularity-release.yml", "release"),
    ("noa-quality-release.yml", "release"),
    ("noa-record-library.yml", "publish"),
    ("noa-root-release.yml", "release"),
    ("noa-scroll-release.yml", "deploy"),
    ("noa-taxonomy-release.yml", "release"),
    ("noa-ui-audit-release.yml", "release"),
    ("noa-upload-buttons.yml", "deploy"),
    ("noa-upload-first-link-repair.yml", "recover"),
    ("noa-upload-status.yml", "deploy"),
    ("noa-upload-wake.yml", "deploy"),
    ("noa-vocal-record.yml", "deploy"),
    ("noa-playlist-safe-production.yml", "verify-and-deploy"),
    ("noa-upload-commit-diagnosis.yml", "diagnose"),
    ("n80-app-integration.yml", "integrate"),
    ("n80-guardian-production-audit.yml", "verify"),
    ("noa-backup-migration-inspect.yml", "inspect"),
    ("n80-ssh-release-capability.yml", "probe"),
]


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
    # Deleted legacy executors are retired, not missing deployment dependencies.
    # Reject their restoration so cleanup cannot reopen an old execution path.
    cleanup = json.loads(CLEANUP.read_text(encoding="utf-8"))
    for relative in cleanup["retiredWorkflows"]:
        if (WORKFLOWS / Path(relative).name).exists():
            bad.append(f"{Path(relative).name}: retired_workflow_restored")
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
        if not path.exists():
            continue
        body = path.read_text(encoding="utf-8")
        if ("if: ${{ false }}" not in body or
             "retired" not in body.lower() or
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
    # Reject any future commit that brings an old SSH or host-deploy job back.
    for name, job in RETIRED_HOST_JOBS:
        path = WORKFLOWS / name
        if not path.exists():
            continue
        content = path.read_text(encoding="utf-8")
        required = f"\n  {job}:\n" + "    if: ${{ false }}"
        if required not in content:
            bad.append(f"{name}: unauthorized_host_job_reactivated")
        try:
            section = content.split("\n"+"jobs:"+"\n", 1)[1]
            block = section.split(f"  {job}:\n", 1)[1]
            job_lines = block.splitlines()
            stop = next((i for i, line in enumerate(job_lines)
                         if line.startswith("  ") and not line.startswith("    ")
                         and line.rstrip().endswith(":")), len(job_lines))
            conditions = [line for line in job_lines[:stop]
                          if line.startswith("    if:")]
            if len(conditions) != 1:
                bad.append(f"{name}: duplicate_or_missing_job_condition")
        except (IndexError, ValueError):
            bad.append(f"{name}: retired_job_block_missing")
    # A future legacy deployment or GitHub Actions reactivation must fail CI.
    # Require exactly one inert job and no host, media or queue work.
    for name in RETIRED_N80_BUSINESS_WORKFLOWS:
        path = WORKFLOWS / name
        if not path.exists():
            continue
        content = path.read_text(encoding="utf-8")
        if (not re.search(r"(?m)^on:\n  workflow_dispatch:\n", content)
                or not re.search(
                    r"(?m)^jobs:\n  retired:\n    if: \$\{\{ false \}\}\n", content)
                or re.search(
                    r"(?m)^  (?!retired:)[a-zA-Z_][\w-]*:\s*$",
                    content.split("jobs:\n", 1)[-1])
                or any(token in content for token in (
                    "NOA_SSH_", "NOA_FTP_", "scripts/n80_auto.py",
                    "api.github.com", "curl ", "paramiko",
                    "workflow_run:", "schedule:", "repository_dispatch:"))):
            bad.append(f"{name}: retired_github_business_worker_reactivated")
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
