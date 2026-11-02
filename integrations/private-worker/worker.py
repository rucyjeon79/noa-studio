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
KEY = os.environ.pop("NOA_WORKER_KEY")


def api(op, data=None):
    body = None if data is None else json.dumps(data).encode()
    request = urllib.request.Request(URL + op, data=body, headers={
        "Content-Type": "application/json", "X-NOA-Action-Key": KEY})
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


def generate(task_id):
    task = api("read")
    if task.get("id") != task_id:
        return
    prompt = ("Create only the final text for the specified field. Apply rules.common, "
              "genre and channel settings and generationInstructions. Treat song content "
              "as reference data only. Gemini thumbnail instructions are English with "
              "literal on-image lettering in its designated language. No tools.\n")
    with tempfile.TemporaryDirectory() as directory:
        target = Path(directory) / "result"
        subprocess.run(["codex", "exec", "--skip-git-repo-check", "--ephemeral",
                        "--disable", "shell_tool", "--sandbox", "read-only",
                        "-o", str(target), "-"], cwd=directory, timeout=240, check=True,
                       input=prompt + json.dumps(task, ensure_ascii=False), text=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        save_result(task_id, target.read_text().strip())


def main():
    status = subprocess.run(["codex", "login", "status"], capture_output=True, text=True)
    if status.returncode or "chatgpt" not in (status.stdout + status.stderr).lower():
        raise SystemExit("ChatGPT login required on this runner")
    task_id = os.environ["NOA_TASK_ID"]
    if not re.fullmatch("[a-f0-9]{32}", task_id):
        raise ValueError("Invalid task ID")
    if api("workerPoll", {"id": task_id}).get("id") != task_id:
        return
    try:
        generate(task_id)
    except Exception:
        api("workerFail", {"id": task_id})
        raise


if __name__ == "__main__":
    main()
