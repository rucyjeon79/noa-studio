"""Offline contracts for the report-only pipeline and credential isolation."""
import importlib.util
import io
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
sys.path.insert(0, str(SCRIPTS))
import n80_completion_pipeline as pipeline
import n80_report_evidence as evidence


class CompletionPipelineTests(unittest.TestCase):
    def test_only_same_sha_main_deployment_success(self):
        sha = "a" * 40
        row = {"id": 1, "head_sha": sha, "head_branch": "main", "event": "push", "path": pipeline.DEPLOY_PATH,
               "status": "completed", "conclusion": "success", "repository": {"full_name": evidence.REPO},
               "html_url": f"https://github.com/{evidence.REPO}/actions/runs/1", "updated_at": "2026-10-24T10:00:00Z"}
        with patch.object(pipeline, "api", return_value={"workflow_runs": [row]}):
            self.assertEqual(pipeline.deployment(sha, 0)["id"], 1)
        for bad in (dict(row, conclusion="failure"), dict(row, head_branch="evil"), dict(row, path="other.yml"), dict(row, head_sha="b" * 40)):
            with patch.object(pipeline, "api", return_value={"workflow_runs": [bad]}):
                with self.assertRaises(evidence.EvidenceError):
                    pipeline.deployment(sha, 0)

    def download(self, location, directory):
        error = urllib.error.HTTPError("https://api.github.com/", 302, "redirect", {"Location": location}, io.BytesIO())
        opener = unittest.mock.Mock()
        opener.open.side_effect = error
        with patch.dict(os.environ, {"GH_TOKEN": "test-token"}), patch.object(pipeline.urllib.request, "build_opener", return_value=opener), \
             patch.object(evidence, "request", return_value=(200, {}, b"zip")) as fetch:
            result = pipeline.download_artifact(3, Path(directory) / "proof.zip")
            request = opener.open.call_args.args[0]
            self.assertEqual(request.get_header("Authorization"), "Bearer test-token")
            self.assertEqual(fetch.call_args.kwargs["headers"], {})
            self.assertEqual(result, b"zip")

    def test_redirect_blob_receives_no_authorization(self):
        with tempfile.TemporaryDirectory() as directory:
            self.download("https://productionresults.blob.core.windows.net/proof?sig=signed", directory)

    def test_redirect_to_unapproved_host_rejected(self):
        for location in ("https://evil.example/", "http://productionresults.blob.core.windows.net/", "https://user@productionresults.blob.core.windows.net/",
                         "https://productionresults.blob.core.windows.net.evil.example/"):
            with tempfile.TemporaryDirectory() as directory:
                with self.assertRaises(evidence.EvidenceError):
                    self.download(location, directory)

    def test_newer_incomplete_deployment_does_not_use_older_success(self):
        sha = "a" * 40
        older = {"id": 1, "head_sha": sha, "head_branch": "main", "event": "push", "path": pipeline.DEPLOY_PATH,
                 "status": "completed", "conclusion": "success"}
        newer = dict(older, id=2, status="in_progress", conclusion=None)
        with patch.object(pipeline, "api", return_value={"workflow_runs": [older, newer]}):
            with self.assertRaisesRegex(evidence.EvidenceError, "not_completed"):
                pipeline.deployment(sha, 0)


if __name__ == "__main__":
    unittest.main()
