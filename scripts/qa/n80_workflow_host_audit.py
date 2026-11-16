#!/usr/bin/env python3
"""Read-only inventory of GitHub workflows contacting the NOA production host."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"

def inspect():
    inventory = []
    total = 0
    for path in sorted(WORKFLOWS.glob("*.y*ml")):
        if path.name.startswith("busan-"):
            continue
        total += 1
        source = path.read_text(encoding="utf-8").splitlines()
        try:
            start = source.index("jobs:")
        except ValueError:
            continue
        jobs = []
        name, lines = None, []
        def record():
            if name is None:
                return
            content = "\n".join(lines)
            if not re.search(r"NOA_(?:SSH|FTP)_(?:HOST|USER|PASSWORD)|N80_HUB_INSTALL|NOA_BACKUP_MIGRATION_MODE",content):
                return
            first = [x for x in lines if re.match(r"^    if:",x)]
            retired = bool(first and re.match(r"^    if:\s*\$\{\{\s*false\s*\}\}",first[0]))
            inventory.append({"workflow":path.name,"job":name,"retired":retired})
        for line in source[start+1:]:
            m = re.match(r"^  ([A-Za-z_][\w-]*):\s*$",line)
            if m:
                record()
                name = m.group(1)
                lines = []
            elif name is not None:
                if line and not line.startswith(" ") and not line.startswith("#"):
                    record()
                    name = None
                    lines = []
                else:
                    lines.append(line)
        record()
    active = [x for x in inventory if not x["retired"]]
    for item in active:
        print("N80_HOST_JOB_ACTIVE " + json.dumps(item,ensure_ascii=False))
    print("N80_WORKFLOW_HOST_AUDIT " + json.dumps({
        "workflowFiles":total,"hostConnectedJobs":len(inventory),
        "retired":len(inventory)-len(active),"active":len(active),
        "hostWrites":0,"networkCalls":0,"readOnly":True
    }))
    return len(active)

if __name__ == "__main__":
    inspect()
