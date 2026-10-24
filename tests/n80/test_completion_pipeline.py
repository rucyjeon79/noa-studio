"""Offline contracts for the report-only pipeline and credential isolation."""
import importlib.util
import io
import json
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
    def test_scope_uses_actual_release_push_paths(self):
        workflow = (SCRIPTS.parent / pipeline.DEPLOY_PATH).read_text()
        patterns = pipeline.release_patterns(workflow)
        self.assertIn('scripts/qa/noa-sitemap-live.mjs', patterns)
        self.assertNotIn('tests/deployment/test_finish_release.py', patterns)  # PR-only path.
        sha, before = 'a' * 40, 'b' * 40
        for path, expected in [('deploy/noa-music.php', True), ('bridge/user-playlists.php', True),
                               ('deploy/noa-app/engine/completion-report.php', True), ('scripts/qa/noa-finish-live.mjs', True),
                               ('scripts/qa/unrelated.mjs', False), ('tests/n80/test_completion_pipeline.py', False),
                               ('scripts/n80_completion_pipeline.py', False), ('bridge/other-work.php', False)]:
            with self.subTest(path=path), patch.object(pipeline.subprocess, 'run', return_value=type('Diff', (), {'stdout': (path + '\0').encode()})()) as git:
                self.assertEqual(pipeline.release_scope('push', {'before': before}, 'refs/heads/main', sha, patterns), expected)
                self.assertEqual(git.call_args.args[0][-4:], ['-z', before, sha, '--'])
                self.assertIn('--no-renames', git.call_args.args[0])

    def test_scope_pr_false_and_manual_main_true_without_diff(self):
        with patch.object(pipeline.subprocess, 'run') as git:
            self.assertFalse(pipeline.release_scope('pull_request', {}, 'refs/pull/183/merge', 'a' * 40, ['deploy/**']))
            self.assertTrue(pipeline.release_scope('workflow_dispatch', {}, 'refs/heads/main', 'a' * 40, ['deploy/**']))
            self.assertFalse(pipeline.release_scope('workflow_dispatch', {}, 'refs/heads/other', 'a' * 40, ['deploy/**']))
            git.assert_not_called()

    def test_scope_unknown_filter_format_rejected(self):
        with self.assertRaises(evidence.EvidenceError):
            pipeline.release_patterns('on:\n  push:\n    paths:\n      - deploy/**\n')

    def test_no_live_artifact_records_noop_without_deployment_or_host(self):
        sha = 'a' * 40
        run = {'id': 2, 'repository': {'full_name': evidence.REPO}, 'head_sha': sha, 'head_branch': 'main',
               'event': 'push', 'path': pipeline.VERIFY_PATH, 'status': 'completed', 'conclusion': 'success',
               'html_url': f'https://github.com/{evidence.REPO}/actions/runs/2', 'updated_at': '2026-10-24T10:00:00Z'}
        with tempfile.TemporaryDirectory() as directory:
            event_path = Path(directory) / 'event.json'
            event_path.write_text(json.dumps({'repository': {'full_name': evidence.REPO}, 'workflow_run': run}))
            with patch.dict(os.environ, {'GITHUB_EVENT_PATH': str(event_path), 'RUNNER_TEMP': directory}), \
                 patch.object(pipeline, 'api', side_effect=[run, {'artifacts': [{'name': 'unrelated', 'expired': False}]}]) as api, \
                 patch.object(pipeline, 'deployment') as deploy, patch.object(pipeline, 'download_artifact') as download, \
                 patch.object(pipeline.subprocess, 'run') as host:
                pipeline.report()
                result = json.loads((Path(directory) / 'noa-n80-report/receipt.json').read_text())
                self.assertEqual(result, {'ok': True, 'recorded': False, 'effect': 'no_integrated_release_evidence'})
                self.assertEqual(api.call_count, 2)
                deploy.assert_not_called()
                download.assert_not_called()
                host.assert_not_called()

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
