#!/usr/bin/env python3
"""Reuse the category release and quality gate; only collect/report evidence."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import n80_report_evidence as evidence

DEPLOY_PATH = ".github/workflows/noa-category-order-final.yml"
VERIFY_PATH = ".github/workflows/noa-quality-gates.yml"
ARTIFACT_NAME = "noa-finish-live-"


def api(path):
    evidence.require(re.fullmatch(r"/actions/(?:runs(?:/[1-9][0-9]*(?:/artifacts)?)?|artifacts/[1-9][0-9]*)(?:\?head_sha=[a-f0-9]{40}&per_page=100)?", path), "invalid_pipeline_api_path")
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    evidence.require(bool(token), "github_token_missing")
    status, _, body = evidence.request("https://api.github.com/repos/" + evidence.REPO + path,
                                      {"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json"})
    evidence.require(status == 200, "pipeline_api_failed")
    return json.loads(body)


def deployment(commit, wait_seconds):
    deadline = time.monotonic() + wait_seconds
    while True:
        runs = api("/actions/runs?head_sha=" + commit + "&per_page=100").get("workflow_runs", [])
        candidates = [r for r in runs if r.get("path") == DEPLOY_PATH and r.get("head_branch") == "main"
                      and r.get("event") in ("push", "workflow_dispatch") and r.get("head_sha") == commit]
        # A newer failed/in-progress rerun must never be masked by an old success.
        latest = max(candidates, key=lambda r: (r["id"], r.get("run_attempt", 1)), default=None)
        if latest and latest.get("status") == "completed":
            evidence.verified_run(latest, latest["id"], commit)
            return latest
        evidence.require(time.monotonic() < deadline, "same_sha_deployment_not_completed")
        time.sleep(min(15, max(0, deadline - time.monotonic())))


def download_artifact(artifact_id, destination):
    """Resolve API redirect with auth; fetch signed blob separately with no auth."""
    evidence.require(re.fullmatch(r"[1-9][0-9]*", str(artifact_id)), "invalid_artifact_id")
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    evidence.require(bool(token), "github_token_missing")
    url = f"https://api.github.com/repos/{evidence.REPO}/actions/artifacts/{artifact_id}/zip"
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json"})
    # urllib's default redirect forwarding can leak Authorization to blob hosts.
    class RejectRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    try:
        urllib.request.build_opener(RejectRedirect()).open(req, timeout=30).close()
        raise evidence.EvidenceError("artifact_redirect_missing")
    except urllib.error.HTTPError as response:
        evidence.require(response.code == 302, "artifact_redirect_failed")
        location = response.headers.get("Location", "")
        response.close()
    p = urllib.parse.urlsplit(location)
    evidence.require(p.scheme == "https" and not p.username and not p.password and p.port is None and not p.fragment
                     and any((p.hostname or "").endswith(suffix) for suffix in
                             (".blob.core.windows.net", ".actions.githubusercontent.com", ".amazonaws.com")), "artifact_redirect_host_rejected")
    status, _, archive = evidence.request(location, headers={}, maximum=32 * evidence.LIMIT)
    evidence.require(status == 200, "artifact_download_failed")
    Path(destination).write_bytes(archive)
    return archive


def report():
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    triggered = event.get("workflow_run", {})
    evidence.require(event.get("repository", {}).get("full_name") == evidence.REPO, "event_repository_mismatch")
    evidence.require(triggered.get("head_branch") == "main" and triggered.get("event") in ("push", "workflow_dispatch"), "untrusted_verification_event")
    commit = triggered.get("head_sha", "")
    evidence.require(re.fullmatch(r"[a-f0-9]{40}", commit), "invalid_commit")
    run = api("/actions/runs/" + str(triggered["id"]))
    evidence.require(run.get("path") == VERIFY_PATH and run.get("head_branch") == "main", "wrong_verification_workflow")
    evidence.verified_run(run, triggered["id"], commit)
    dep = deployment(commit, 0)
    artifacts = api("/actions/runs/" + str(run["id"]) + "/artifacts").get("artifacts", [])
    matches = [a for a in artifacts if a.get("name") == ARTIFACT_NAME + str(run["id"]) and a.get("expired") is False]
    evidence.require(len(matches) == 1, "verification_artifact_missing_or_duplicate")
    metadata = api("/actions/artifacts/" + str(matches[0]["id"]))
    evidence.require(metadata.get("id") == matches[0]["id"], "artifact_identity_mismatch")
    out = Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "noa-n80-report"
    out.mkdir(mode=0o700, exist_ok=True)
    archive_path = out / "verified.zip"
    archive = download_artifact(metadata["id"], archive_path)
    evidence.verified_artifact(metadata, run["id"], commit, archive, "verified.json")
    checks = [{"url": evidence.ORIGIN + p, "expectedStatus": s} for p, s in
              [("/", 200), ("/noa-music.php", 200), ("/noa-my.php", 200), ("/noa-sitemap.php", 200),
               ("/bbs/login.php", 200), ("/noa-app/jukebox/", 403)]]
    checks_path = out / "checks.json"
    checks_path.write_text(json.dumps(checks))
    # The parent-owned, Drive-verified release manifest defines the affected set.
    receipt = json.loads(Path("scripts/noa_finish_drive_receipt.json").read_text())
    sources = sorted(p for p in receipt["files"] if evidence.safe_path(p))
    evidence.require(bool(sources), "release_sources_missing")
    cmd = [sys.executable, "scripts/n80_report_evidence.py", "--repository", ".", "--commit", commit,
           "--deployment-run", str(dep["id"]), "--verification-run", str(run["id"]),
           "--artifact-id", str(metadata["id"]), "--artifact-zip", str(archive_path), "--report-member", "verified.json",
           "--module", "admin", "--task", "integration-finish-20261024", "--owner", "Work_integration",
           "--checks", str(checks_path), "--output", str(out / "receipt.json")]
    for path in sources:
        cmd.extend(["--source", path])
    subprocess.run(cmd, check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("wait", "report"))
    parser.add_argument("--commit")
    args = parser.parse_args()
    try:
        if args.action == "wait":
            evidence.require(bool(re.fullmatch(r"[a-f0-9]{40}", args.commit or "")), "invalid_commit")
            result = deployment(args.commit, 1200)
            print(json.dumps({"ok": True, "deploymentRun": str(result["id"]), "commit": args.commit}))
        else:
            report()
    except evidence.EvidenceError as error:
        print(json.dumps({"ok": False, "error": str(error)}))
        raise SystemExit(1) from None
    except Exception:
        print(json.dumps({"ok": False, "error": "completion_pipeline_failed"}))
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
