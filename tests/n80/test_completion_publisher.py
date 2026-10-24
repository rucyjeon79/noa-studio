import copy
import hashlib
import hmac
import importlib.util
import io
import json
from pathlib import Path
import stat
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("publisher", ROOT / "scripts/n80_report_evidence.py")
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
COMMIT = "a" * 40


def artifact(report=None):
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as z:
        z.writestr("verified.json", json.dumps(report if report is not None else {"ok": True, "cases": [{"ok": True}]}))
    archive = out.getvalue()
    return {"id": 3, "expired": False, "digest": "sha256:" + p.sha(archive), "workflow_run": {"id": 2, "head_sha": COMMIT}}, archive


class CompletionPublisherTests(unittest.TestCase):
    def test_run_completed_success_and_exact_commit(self):
        row = {"id": 2, "repository": {"full_name": p.REPO}, "status": "completed", "conclusion": "success", "head_sha": COMMIT,
               "html_url": f"https://github.com/{p.REPO}/actions/runs/2", "updated_at": "2026-10-24T10:00:00Z"}
        self.assertEqual(p.verified_run(row, "2", COMMIT)["runId"], "2")
        for key, value in [("status", "in_progress"), ("conclusion", "failure"), ("head_sha", "b" * 40)]:
            bad = dict(row, **{key: value})
            with self.assertRaises(p.EvidenceError):
                p.verified_run(bad, "2", COMMIT)

    def test_artifact_provenance_and_content(self):
        metadata, archive = artifact()
        self.assertEqual(p.verified_artifact(metadata, "2", COMMIT, archive, "verified.json")["passedCases"], 1)
        for mutation in (lambda x: x.update(digest="sha256:" + "0" * 64), lambda x: x["workflow_run"].update(id=4),
                         lambda x: x.update(expired=True), lambda x: x["workflow_run"].update(head_sha="b" * 40)):
            bad = copy.deepcopy(metadata)
            mutation(bad)
            with self.assertRaises(p.EvidenceError):
                p.verified_artifact(bad, "2", COMMIT, archive, "verified.json")
        for report in ({"ok": True}, {"ok": True, "cases": [{"ok": False}]}, {"ok": True, "cases": [{}]},
                       {"ok": True, "errors": ["failure"], "cases": [{"ok": True}]}, {"ok": False, "cases": [{"ok": True}]}):
            metadata, archive = artifact(report)
            with self.assertRaises(p.EvidenceError):
                p.verified_artifact(metadata, "2", COMMIT, archive, "verified.json")

    def test_no_arbitrary_paths_or_urls(self):
        for path in ("common.php", "config.php", "../noa.php", "noa-app/../common.php", "noa-app//test.php", "/noa-music.php", "noa-ai-lab/worker.key"):
            self.assertFalse(p.safe_path(path), path)
        self.assertTrue(p.safe_path("noa-app/engine/completion-report.php"))
        for url in ("https://evil.example/noa-music.php", "https://noastudio.ai.kr.evil/noa-music.php", "http://noastudio.ai.kr/",
                    "https://user@noastudio.ai.kr/", "https://noastudio.ai.kr:443/", "https://noastudio.ai.kr/noa-music.php?token=secret",
                    "https://noastudio.ai.kr/noa-music.php?view=%00"):
            self.assertFalse(p.safe_url(url), url)
        self.assertTrue(p.safe_url("https://noastudio.ai.kr/noa-music.php?view=music"))

    def test_sftp_readback_mismatch_and_noncanonical_rejected(self):
        class SFTP:
            def normalize(self, path): return path
            def lstat(self, path): return type("Stat", (), {"st_mode": stat.S_IFREG, "st_size": 4})()
            def open(self, path, mode): return io.BytesIO(b"live")
        with patch.object(p.subprocess, "run", return_value=type("Result", (), {"stdout": b"live"})()):
            self.assertEqual(p.source_readback(SFTP(), ".", COMMIT, ["noa-music.php"])[0]["sha256"], p.sha(b"live"))
        with patch.object(p.subprocess, "run", return_value=type("Result", (), {"stdout": b"old"})()):
            with self.assertRaisesRegex(p.EvidenceError, "source_readback_mismatch"):
                p.source_readback(SFTP(), ".", COMMIT, ["noa-music.php"])
        sftp = SFTP()
        sftp.normalize = lambda _: "/somewhere/else"
        with patch.object(p.subprocess, "run", return_value=type("Result", (), {"stdout": b"live"})()):
            with self.assertRaisesRegex(p.EvidenceError, "noncanonical"):
                p.source_readback(sftp, ".", COMMIT, ["noa-music.php"])

    def test_signed_receipt_readback_and_scope(self):
        event = {"id": "n80-test"}
        key = b"a" * 64
        def respond(url, headers, raw, maximum):
            self.assertEqual(url, p.ENDPOINT)
            nonce = headers["X-N80-Nonce"]
            expected = hmac.new(key, ("N80-COMPLETION-1\n" + p.sha(raw) + "\n" + headers["X-N80-Timestamp"] + "\n" + nonce).encode(), hashlib.sha256).hexdigest()
            self.assertEqual(headers["X-N80-Signature"], expected)
            result = {"ok": True, "eventId": event["id"], "eventSha256": p.sha(p.compact(event)), "readbackVerified": True,
                      "effect": "task_runtime_evidence_recorded", "automaticDispatch": False, "businessAck": False,
                      "queueMutation": False, "workerExecuted": False, "databaseWrites": 0}
            body = p.compact({"ok": True, "nonce": nonce, "principal": "n80_reporter", "result": result})
            signature = hmac.new(key, ("N80-COMPLETION-RESPONSE-1\n" + nonce + "\n" + p.sha(body)).encode(), hashlib.sha256).hexdigest()
            return 200, {"X-N80-Signature": signature}, body
        with patch.object(p, "request", side_effect=respond):
            self.assertTrue(p.publish(event, key)["readbackVerified"])
        with patch.object(p, "request", return_value=(200, {"X-N80-Signature": "0" * 64}, b"{}")):
            with self.assertRaisesRegex(p.EvidenceError, "signature"):
                p.publish(event, key)

    def test_exact_design_loader_mapping_and_other_extensions_denied(self):
        self.assertTrue(p.safe_path("extend/noa.design.php"))
        for path in ("extend/other.php", "extend/../config.php", "extend/noa.design.php/extra"):
            self.assertFalse(p.safe_path(path))
        class SFTP:
            def normalize(self, path): return path
            def lstat(self, path): return type("Stat", (), {"st_mode": stat.S_IFREG, "st_size": 4})()
            def open(self, path, mode): return io.BytesIO(b"live")
        with patch.object(p.subprocess, "run", return_value=type("Result", (), {"stdout": b"live"})()) as git:
            result = p.source_readback(SFTP(), ".", COMMIT, ["extend/noa.design.php"])
            self.assertIn(COMMIT + ":deploy/noa-design.extend.php", git.call_args.args[0])
            self.assertEqual(result[0]["path"], "extend/noa.design.php")
            self.assertTrue(result[0]["readbackVerified"])

    def test_identity_is_deterministic(self):
        dep, ver = {"runId": "1"}, {"runId": "2", "artifactSha256": "a" * 64, "updatedAt": "2026-10-24T10:00:00Z"}
        args = ("work.completed", "admin", "task", "Work", COMMIT, dep, ver, [], [])
        self.assertEqual(p.build_event(*args), p.build_event(*args))
        self.assertTrue(p.build_event(*args)["id"].startswith("n80-completion-"))


if __name__ == "__main__":
    unittest.main()
