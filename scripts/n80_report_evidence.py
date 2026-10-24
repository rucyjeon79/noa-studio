#!/usr/bin/env python3
"""Record current-task live evidence, without business dispatch or SQL access.

Run only after both referenced Actions runs have completed successfully. The
artifact ZIP is downloaded by the existing Actions tooling, not by this script.
No credential, raw response or report body is printed.
"""
import argparse
import base64
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import stat
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

REPO = "rucyjeon79/noa-studio"
ORIGIN = "https://noastudio.ai.kr"
ENDPOINT = ORIGIN + "/noa-app/engine/completion-report.php"
HOST_ROOT = "/hosting/noastudio/html"
KEY_PATH = "/hosting/noastudio/noa-ai-lab/worker.key"
LIMIT = 4 * 1024 * 1024


class EvidenceError(Exception):
    """Safe error code only; never include remote content or credentials."""


def require(condition, code):
    if not condition:
        raise EvidenceError(code)


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()


def sha(value):
    return hashlib.sha256(value).hexdigest()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise EvidenceError("redirect_rejected")


def request(url, headers=None, data=None, maximum=LIMIT):
    req = urllib.request.Request(url, data=data, headers=headers or {})
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=30) as response:
            body = response.read(maximum + 1)
            require(len(body) <= maximum, "response_too_large")
            return response.status, response.headers, body
    except urllib.error.HTTPError as error:
        if error.code in (401, 403) and data is None:
            return error.code, {}, b""
        raise EvidenceError("http_request_failed") from None


def github(path, token):
    require(re.fullmatch(r"/actions/(?:runs/[1-9][0-9]*|artifacts/[1-9][0-9]*)", path), "invalid_api_path")
    status, _, body = request("https://api.github.com/repos/" + REPO + path,
                              {"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json"})
    require(status == 200, "github_lookup_failed")
    try:
        return json.loads(body)
    except (ValueError, UnicodeError):
        raise EvidenceError("invalid_github_response") from None


def verified_run(value, run_id, commit):
    require(str(value.get("id")) == str(run_id), "run_identity_mismatch")
    require(value.get("repository", {}).get("full_name") == REPO, "run_repository_mismatch")
    require(value.get("status") == "completed" and value.get("conclusion") == "success", "run_not_successful")
    require(value.get("head_sha") == commit, "run_commit_mismatch")
    require(value.get("html_url") == f"https://github.com/{REPO}/actions/runs/{run_id}", "run_url_mismatch")
    require(re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", value.get("updated_at", "")), "invalid_run_time")
    return {"runId": str(run_id), "headSha": commit, "status": "completed", "conclusion": "success",
            "url": value["html_url"], "updatedAt": value["updated_at"]}


def verified_artifact(metadata, run_id, commit, archive, member):
    require(metadata.get("expired") is False, "artifact_expired")
    require(metadata.get("workflow_run", {}).get("id") == int(run_id), "artifact_run_mismatch")
    require(metadata.get("workflow_run", {}).get("head_sha") == commit, "artifact_commit_mismatch")
    require(metadata.get("digest") == "sha256:" + sha(archive), "artifact_digest_mismatch")
    require(re.fullmatch(r"[A-Za-z0-9_/-]+\.json", member) and ".." not in member and not member.startswith("/"), "invalid_report_member")
    try:
        with zipfile.ZipFile(io.BytesIO(archive)) as z:
            require(z.namelist().count(member) == 1, "report_member_missing_or_duplicate")
            info = z.getinfo(member)
            require(info.file_size <= LIMIT and info.compress_size <= LIMIT, "report_too_large")
            body = z.read(info)
        report = json.loads(body)
    except (ValueError, zipfile.BadZipFile, UnicodeError, RuntimeError):
        raise EvidenceError("invalid_report_artifact") from None
    require(isinstance(report, dict) and report.get("ok") is True, "report_not_successful")
    require(not report.get("errors"), "report_has_errors")
    rows = report.get("cases", report.get("rows"))
    require(isinstance(rows, list) and 0 < len(rows) <= 100000, "report_cases_missing")
    require(all(isinstance(row, dict) and row.get("ok") is True for row in rows), "report_case_not_verified")
    return {"artifactId": str(metadata["id"]), "artifactSha256": sha(archive), "reportMember": member,
            "reportSha256": sha(body), "passedCases": len(rows)}


def safe_path(path):
    return isinstance(path, str) and len(path) <= 240 and ".." not in path and "//" not in path and bool(re.fullmatch(
        r"(?:noa-[a-z0-9-]+\.(?:php|js|css|json)|noa-(?:app|bridge)/[A-Za-z0-9_/-]+\.(?:php|js|css|json))", path))


def source_readback(sftp, repository, commit, paths):
    require(1 <= len(paths) <= 100 and len(paths) == len(set(paths)), "invalid_source_list")
    result = []
    for path in sorted(paths):
        require(safe_path(path), "unsafe_source_path")
        try:
            source = "bridge/" + path[len("noa-bridge/"):] if path.startswith("noa-bridge/") else "deploy/" + path
            local = subprocess.run(["git", "-C", str(repository), "show", commit + ":" + source],
                                   check=True, capture_output=True).stdout
        except subprocess.CalledProcessError:
            raise EvidenceError("source_commit_file_missing") from None
        remote = HOST_ROOT + "/" + path
        require(sftp.normalize(remote) == remote, "source_noncanonical_path")
        info = sftp.lstat(remote)
        require(stat.S_ISREG(info.st_mode) and 0 < info.st_size <= LIMIT, "source_not_regular_or_bounded")
        require(0 < len(local) <= LIMIT, "source_size_invalid")
        with sftp.open(remote, "rb") as handle:
            live = handle.read(LIMIT + 1)
        require(live == local, "source_readback_mismatch")
        result.append({"path": path, "sha256": sha(live), "bytes": len(live), "readbackVerified": True})
    return result


def safe_url(url):
    p = urllib.parse.urlsplit(url)
    if p.scheme != "https" or p.netloc != "noastudio.ai.kr" or p.fragment:
        return False
    if not re.fullmatch(r"/(?:|index\.php|noa-[a-z0-9-]+\.php|noa-app/(?:jukebox|database|taxonomy)/|noa-app/jukebox/stream\.php|bbs/(?:login|register|board)\.php)", p.path):
        return False
    return all(k in {"view", "group", "genre", "act", "track", "story", "detail", "key", "type", "bo_table"}
               and len(v) <= 190 and not re.search(r"[\x00-\x1f]", v)
               for k, v in urllib.parse.parse_qsl(p.query, keep_blank_values=True))


def http_evidence(checks):
    require(1 <= len(checks) <= 32, "invalid_http_checks")
    result = []
    for item in checks:
        require(set(item) == {"url", "expectedStatus"} and safe_url(item["url"]), "unsafe_http_check")
        require(item["expectedStatus"] in (200, 206, 401, 403), "invalid_expected_status")
        status, _, _ = request(item["url"], {"Range": "bytes=0-4095"}, maximum=LIMIT)
        require(status == item["expectedStatus"], "live_http_status_mismatch")
        result.append({"url": item["url"], "status": status, "expectedStatus": status})
    return result


def build_event(kind, module, task, owner, commit, deployment, verification, files, http):
    identity = "|".join([kind, module, task, commit, deployment["runId"], verification["runId"], verification["artifactSha256"]])
    event_id = "n80-completion-" + sha(identity.encode())
    return {"id": event_id, "type": kind, "source": "deployment", "subjectId": module,
            "occurredAt": verification["updatedAt"], "schemaVersion": 1, "correlationId": event_id,
            "evidence": {"repository": REPO, "taskId": task, "owner": owner, "commit": commit,
                         "deployment": deployment, "verification": verification, "files": files, "http": http,
                         "scope": "task_runtime_evidence_only"}}


def publish(event, key):
    require(len(key) == 64, "reporter_key_invalid")
    nonce, timestamp = secrets.token_hex(16), str(int(time.time()))
    raw = compact({"action": "record", "event": event})
    require(len(raw) <= 65536, "request_too_large")
    signature = hmac.new(key, ("N80-COMPLETION-1\n" + sha(raw) + "\n" + timestamp + "\n" + nonce).encode(), hashlib.sha256).hexdigest()
    status, headers, body = request(ENDPOINT, {"Content-Type": "application/json", "X-N80-Timestamp": timestamp,
                                             "X-N80-Nonce": nonce, "X-N80-Signature": signature}, raw, 65536)
    expected = hmac.new(key, ("N80-COMPLETION-RESPONSE-1\n" + nonce + "\n" + sha(body)).encode(), hashlib.sha256).hexdigest()
    require(status == 200 and hmac.compare_digest(expected, headers.get("X-N80-Signature", "")), "receipt_signature_invalid")
    try:
        receipt = json.loads(body)
    except (ValueError, UnicodeError):
        raise EvidenceError("invalid_receipt") from None
    result = receipt.get("result", {})
    require(receipt.get("ok") is True and receipt.get("nonce") == nonce and receipt.get("principal") == "n80_reporter", "receipt_identity_invalid")
    require(result.get("ok") is True and result.get("eventId") == event["id"] and result.get("eventSha256") == sha(compact(event)), "receipt_event_mismatch")
    require(result.get("readbackVerified") is True and result.get("effect") == "task_runtime_evidence_recorded", "receipt_readback_missing")
    require(all(result.get(k) is False for k in ("automaticDispatch", "businessAck", "queueMutation", "workerExecuted")) and result.get("databaseWrites") == 0, "receipt_scope_invalid")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("repository", "commit", "deployment-run", "verification-run", "artifact-id", "artifact-zip", "report-member", "module", "task", "owner", "checks", "output"):
        parser.add_argument("--" + name, required=True)
    parser.add_argument("--type", choices=("deploy.verified", "work.completed"), default="work.completed")
    parser.add_argument("--source", action="append", required=True, help="Path below deploy/, e.g. noa-music.php")
    args = parser.parse_args()
    try:
        require(bool(re.fullmatch(r"[a-f0-9]{40}", args.commit)), "invalid_commit")
        token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
        require(bool(token), "github_token_missing")
        dep = verified_run(github("/actions/runs/" + args.deployment_run, token), args.deployment_run, args.commit)
        ver = verified_run(github("/actions/runs/" + args.verification_run, token), args.verification_run, args.commit)
        archive_path = Path(args.artifact_zip)
        require(archive_path.stat().st_size <= 32 * LIMIT, "artifact_too_large")
        ver.update(verified_artifact(github("/actions/artifacts/" + args.artifact_id, token), args.verification_run,
                                     args.commit, archive_path.read_bytes(), args.report_member))
        # Match n80_live_observer.py's existing NOA authentication and host pin.
        import paramiko
        required = ("NOA_SSH_HOST", "NOA_SSH_USER", "NOA_SSH_PASSWORD", "NOA_SSH_HOST_FINGERPRINT")
        require(all(os.environ.get(name) for name in required), "missing_noa_authentication")
        transport = paramiko.Transport((os.environ["NOA_SSH_HOST"], 2022))
        try:
            transport.get_security_options().key_types = ("ssh-ed25519",)
            transport.start_client(timeout=20)
            fingerprint = "SHA256:" + base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip("=")
            require(hmac.compare_digest(fingerprint, os.environ["NOA_SSH_HOST_FINGERPRINT"]), "host_key_mismatch")
            transport.auth_password(os.environ["NOA_SSH_USER"], os.environ["NOA_SSH_PASSWORD"])
            with paramiko.SFTPClient.from_transport(transport) as sftp:
                sftp.get_channel().settimeout(30)
                files = source_readback(sftp, args.repository, args.commit, args.source)
                checks = http_evidence(json.loads(Path(args.checks).read_text()))
                event = build_event(args.type, args.module, args.task, args.owner, args.commit, dep, ver, files, checks)
                require(sftp.normalize(KEY_PATH) == KEY_PATH and stat.S_ISREG(sftp.lstat(KEY_PATH).st_mode), "reporter_key_path_invalid")
                with sftp.open(KEY_PATH, "rb") as handle:
                    key = handle.read(129).strip()
                result = publish(event, key)
                del key
        finally:
            transport.close()
        Path(args.output).write_bytes(compact({"ok": True, "result": result}) + b"\n")
        print(json.dumps({"ok": True, "eventId": result["eventId"], "status": result["status"], "effect": result["effect"]}))
    except EvidenceError as error:
        print(json.dumps({"ok": False, "error": str(error)}))
        raise SystemExit(1) from None
    except Exception:
        print(json.dumps({"ok": False, "error": "evidence_collection_failed"}))
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
