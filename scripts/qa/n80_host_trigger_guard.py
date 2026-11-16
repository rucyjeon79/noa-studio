#!/usr/bin/env python3
"""Fail closed if GitHub can automatically connect to the DotHome host.

No network calls or production writes. Only an already user-initiated
JUKEBOX upload workflow may combine push-triggered LOCAL tests with
manual-dispatch-only host jobs. All other host-credentialled workflows must
be manual-only pending authenticated N80 owner route migration.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / ".github" / "workflows"
CREDENTIAL = re.compile(r"NOA_(?:SSH|FTP)_(?:HOST|USER|PASSWORD|HOST_FINGERPRINT)|N80_HUB_INSTALL")
AUTOMATIC = {"push", "pull_request", "workflow_run", "schedule", "release",
             "repository_dispatch", "workflow_call", "create", "delete",
             "issues", "issue_comment", "check_run", "check_suite"}
USER_UPLOAD_EXCEPTION = {"noa-jukebox.yml"}


def read_events(lines):
    try:
        index = lines.index("on:")
    except ValueError:
        return []
    tail = lines[index + 1:]
    names = []
    for line in tail:
        if re.match(r"^[A-Za-z_][\w-]*:", line):
            break
        m = re.match(r"^  ([A-Za-z_][\w-]*):", line)
        if m:
            names.append(m.group(1))
    return names


def get_jobs(lines):
    try:
        start = lines.index("jobs:")
    except ValueError:
        return []
    blocks, name, rows = [], None, []
    def append():
        if name is not None:
            blocks.append((name, "\n".join(rows)))
    for line in lines[start + 1:]:
        m = re.match(r"^  ([A-Za-z_][\w-]*):\s*$", line)
        if m:
            append()
            name, rows = m.group(1), []
        elif name is not None:
            if line and not line.startswith(" ") and not line.startswith("#"):
                append()
                name, rows = None, []
            else:
                rows.append(line)
    append()
    return blocks


def main():
    violations, manual_only, exempted = [], 0, 0
    checked, host_jobs = 0, 0
    for path in sorted(DIRECTORY.glob("*.y*ml")):
        if path.name.startswith("busan-"):
            continue
        checked += 1
        lines = path.read_text(encoding="utf-8").splitlines()
        events = set(read_events(lines))
        automatic = bool(events & AUTOMATIC)
        for job, body in get_jobs(lines):
            if not CREDENTIAL.search(body):
                continue
            host_jobs += 1
            if re.search(r"(?m)^    if:\s*(?:\$\{\{\s*)?false(?:\s*\}\})?", body):
                continue
            if not automatic:
                if events == {"workflow_dispatch"}:
                    manual_only += 1
                else:
                    violations.append(f"{path.name}/{job}: unexpected_triggers:{sorted(events)}")
                continue
            first_if = next((x for x in body.splitlines() if x.startswith("    if:")), "")
            manually_gated = bool(re.search(
                r"github[.]event_name\s*==\s*['\"]workflow_dispatch['\"]", first_if))
            if path.name in USER_UPLOAD_EXCEPTION and manually_gated and "schedule" not in events:
                exempted += 1
            else:
                violations.append(f"{path.name}/{job}: unsolicited_host_access:{sorted(events)}")
    print("N80_DOTHOME_TRIGGER_GUARD "+json.dumps({
        "workflowsScanned": checked, "hostJobs":host_jobs,
        "manualOnly": manual_only, "userUploadException": exempted,
        "violations":violations[:40], "violationsCount":len(violations),
        "hostWrites":0, "requestsToDotHome":0
    }, ensure_ascii=False))
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
