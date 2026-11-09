"""Run on the owner's dedicated private runner with Codex logged in to ChatGPT."""
import json
import os
import re
import subprocess
import tempfile
import time
import urllib.error
from http.client import IncompleteRead
import urllib.request
from pathlib import Path

URL = "https://noastudio.ai.kr/noa-gpt.php?op="
KEY = os.environ.pop("NOA_WORKER_KEY", "")
LEASE = ""
from agent import Commander


def api(op, data=None):
    body = None if data is None else json.dumps(data).encode()
    request = urllib.request.Request(URL + op, data=body, headers={
        "Content-Type": "application/json", "X-NOA-Action-Key": KEY,
        "X-NOA-Agent-Lease": LEASE})
    with urllib.request.urlopen(request, timeout=15) as response:
        result = json.load(response)
    if result.get("ok") is not True:
        raise ValueError("NOA request failed")
    return result


def save_result(task_id, text):
    # Reuse the request ID and exact output if the server committed before a timeout.
    payload = {"id": task_id, "text": text}
    for attempt in range(3):
        try:
            return api("save", payload)
        except urllib.error.HTTPError as error:
            if error.code not in (502, 503, 504) or attempt == 2:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, IncompleteRead):
            if attempt == 2:
                raise
        time.sleep(2 ** attempt)


def transport(op, data=None):
    if op == "save":
        return save_result(data["id"], data["text"])
    # Exact checkpoint replays are idempotent and never repeat model inference.
    for attempt in range(2):
        try:
            return api(op, data)
        except urllib.error.HTTPError as error:
            if error.code not in (502, 503, 504) or attempt:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, IncompleteRead):
            if attempt:
                raise


def generate(task_id, specialists=None):
    result = Commander(task_id, transport, complete, specialists=specialists).run()
    print("N80_AGENT_RESULT", json.dumps(result))


def complete(prompt, timeout=240):
    with tempfile.TemporaryDirectory() as directory:
        target = Path(directory) / "result"
        process = subprocess.run(["codex", "exec", "--skip-git-repo-check", "--ephemeral",
                        "--disable", "shell_tool", "--sandbox", "read-only",
                        "-o", str(target), "-"], cwd=directory, timeout=max(1, min(240, timeout)),
                       input=prompt, text=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        if process.returncode:
            # Report categories only. Codex stderr can echo the full prompt.
            error = process.stderr.lower()
            markers = ("unknown feature", "unknown option", "unexpected argument", "unsupported", "not supported",
                       "not available", "model_not_found", "401", "403", "429", "usage limit", "refresh_token",
                       "stream disconnected", "failed to connect", "sandbox", "permission denied", "upgrade")
            matches = [marker for marker in markers if marker in error]
            raise RuntimeError("codex_exec_failed: " + ", ".join(matches or ["unclassified"]))
        return target.read_text().strip()


def main():
    global LEASE
    status = subprocess.run(["codex", "login", "status"], capture_output=True, text=True)
    if status.returncode or "chatgpt" not in (status.stdout + status.stderr).lower():
        raise SystemExit("ChatGPT login required on this runner")
    task_id = os.environ["NOA_TASK_ID"]
    if not re.fullmatch("[a-f0-9]{32}", task_id):
        raise ValueError("Invalid task ID")
    from gemini import verify, review, SPECIALIST
    verified = verify()
    print("N80_GEMINI_STATUS", json.dumps(verified))
    specialists = {SPECIALIST: review} if verified["connected"] else {}
    claimed = api("workerPoll", {"id": task_id, "agentVersion": 1, "resume": True, "specialists": list(specialists)})
    if claimed.get("id") != task_id:
        return
    LEASE = claimed.get("agentLease", "")
    if not re.fullmatch("[a-f0-9]{48}", LEASE):
        raise RuntimeError("N80 agent bridge activation required")
    try:
        generate(task_id, specialists)
    except Exception:
        try:
            api("workerFail", {"id": task_id})
        except Exception:
            pass  # Preserve the original error; stale leases must not change a newer job.
        raise


if __name__ == "__main__":
    main()
