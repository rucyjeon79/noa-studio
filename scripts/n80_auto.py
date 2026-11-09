"""N80 Auto's fixed operation dispatcher. Existing workflows retain their concurrency lanes.

No shell, arbitrary command, credential override, deployment fallback or new scheduler.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request
import urllib.error


def host_owned(operation):
    if operation not in {"ai.text", "catalog.index", "notifications.dispatch", "popularity.calculate"}:
        return False
    url = "https://noastudio.ai.kr/noa-hub-owner.php?operation=" + operation
    try:
        with urllib.request.urlopen(url, timeout=15) as response:
            state = json.load(response)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return False  # Initial migration has not installed Hub yet.
        raise RuntimeError("n80_hub_ownership_unconfirmed") from None
    if state.get("ok") is not True or state.get("operation") != operation or state.get("owner") not in ("n80_hub", "legacy"):
        raise RuntimeError("n80_hub_ownership_unconfirmed")
    return state["owner"] == "n80_hub"

ROOT = Path(__file__).resolve().parent.parent


def plan(operation, environment):
    manifest = json.loads((ROOT / 'config/n80-automation.json').read_text())
    row = manifest['operations'].get(operation)
    if not row:
        raise RuntimeError('unregistered_n80_operation')
    workflow = environment.get('GITHUB_WORKFLOW_REF', '')
    expected = 'rucyjeon79/noa-studio/.github/workflows/' + row['workflow'] + '@refs/heads/main'
    if workflow != expected or environment.get('GITHUB_REPOSITORY') != 'rucyjeon79/noa-studio':
        raise RuntimeError('n80_operation_owner_mismatch')
    if any(environment.get(key) != value for key, value in row['requiredEnv'].items()):
        raise RuntimeError('n80_operation_runtime_mode_required')
    return row


def main():
    if len(sys.argv) != 2:
        raise RuntimeError('one_n80_operation_required')
    operation = sys.argv[1]
    row = plan(operation, os.environ)
    if host_owned(operation):
        print("N80_AUTO_HOST_OWNED", json.dumps({"operation": operation, "owner": "N80 Hub", "executed": False}))
        return
    started = time.monotonic()
    print('N80_AUTO_STARTED', json.dumps({'operation': operation, 'module': row['module']}), flush=True)
    code = 1
    try:
        code = subprocess.run([sys.executable, *row['command']], cwd=ROOT, check=False).returncode
    finally:
        print('N80_AUTO_FINISHED', json.dumps({'operation': operation, 'module': row['module'],
              'exitCode': code, 'elapsedMs': round((time.monotonic() - started) * 1000)}), flush=True)
    raise SystemExit(code)


if __name__ == '__main__':
    main()
