"""Guard the only existing-file replacement with Drive proof and exact version."""
import json
import io
import urllib.error
import urllib.parse
from email.message import Message
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import n80_app_integration as runtime
from test_live_observer import Host, MemoryFile


class RuntimeHost(Host):
    def open(self, path, mode):
        if mode == 'wb':
            self.writes.append(path)
            return MemoryFile(b'', lambda data: self.files.__setitem__(path, data))
        return super().open(path, mode)


class IntegrationDeploymentTest(unittest.TestCase):
    def setUp(self):
        self.baseline = b'o' * 1148
        self.old_sha = runtime.sha(self.baseline)
        self.proof = {'sha256': self.old_sha, 'bytes': 1148,
                      'readbackVerified': True, 'driveId': 'verified-drive-file'}
        self.host = RuntimeHost()
        for rel in runtime.NEW_FILES:
            self.host.files[runtime.ROOT + '/' + rel] = (Path('deploy') / rel).read_bytes()
        self.target = runtime.ROOT + '/' + runtime.ADAPTER
        self.host.files[self.target] = self.baseline
        self.patches = [patch.object(runtime, 'OLD_SHA', self.old_sha),
                        patch.object(Path, 'read_text', return_value=json.dumps(self.proof)),
                        patch.object(runtime.subprocess, 'check_output', return_value=self.baseline),
                        patch.object(runtime.subprocess, 'run'),
                        patch.object(runtime, 'compare_sources', return_value={
                            'rows': [], 'allMatch': True, 'requiredCount': 29})]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

    def test_exact_preimage_changes_only_final_adapter_and_replay_is_read_only(self):
        first = runtime.install(self.host)
        self.assertEqual(first['changedFiles'], [runtime.ADAPTER])
        self.assertEqual(self.host.writes, [self.target])
        second = runtime.install(self.host)
        self.assertEqual(second['changedFiles'], [])

    def test_unknown_concurrent_version_is_preserved(self):
        self.host.files[self.target] = b'other work'
        with self.assertRaisesRegex(RuntimeError, 'concurrent_adapter_change'):
            runtime.install(self.host)
        self.assertEqual(self.host.files[self.target], b'other work')
        self.assertEqual(self.host.writes, [])

    def test_missing_drive_verification_blocks_before_any_host_write(self):
        self.proof['readbackVerified'] = False
        with patch.object(Path, 'read_text', return_value=json.dumps(self.proof)):
            with self.assertRaisesRegex(RuntimeError, 'verified_drive_preimage_required'):
                runtime.install(self.host)
        self.assertEqual(self.host.writes, [])


class GuestAccessProbeTest(unittest.TestCase):
    def opener(self, *, exposed=False, wrong_login=False):
        class Response(io.BytesIO):
            def __init__(self, code, body=b'<!doctype html>home', headers=None):
                super().__init__(body)
                self.code, self.headers = code, headers or Message()

        class Opener:
            def open(self, url, timeout):
                path = urllib.parse.urlsplit(url).path
                if path in ('/', '/bbs/login.php'):
                    return Response(200)
                headers = Message()
                if path.startswith('/noa-bridge/'):
                    if exposed:
                        return Response(200, b'{"items":[]}')
                    headers['X-NOA-Access'] = 'music' if 'playlists' in path else 'member'
                    raise urllib.error.HTTPError(url, 401, 'Unauthorized', headers, io.BytesIO(b'denied'))
                headers['Location'] = ('https://other.invalid' if wrong_login else '') + '/bbs/login.php?url=' + urllib.parse.quote(path, safe='')
                raise urllib.error.HTTPError(url, 302, 'Found', headers, io.BytesIO())
        return Opener()

    def test_guest_login_redirects_and_catalog_denial_are_success(self):
        with patch.object(runtime.urllib.request, 'build_opener', return_value=self.opener()):
            proof = runtime.public_checks()
        self.assertTrue(all(row['ok'] for row in proof['pages']))
        self.assertFalse(proof['media']['checked'])

    def test_unexpected_public_catalog_is_not_accepted(self):
        with patch.object(runtime.urllib.request, 'build_opener', return_value=self.opener(exposed=True)):
            proof = runtime.public_checks()
        self.assertFalse(next(row['ok'] for row in proof['pages'] if row['path'] == '/noa-bridge/catalog.php'))

    def test_redirect_to_another_host_is_not_accepted(self):
        with patch.object(runtime.urllib.request, 'build_opener', return_value=self.opener(wrong_login=True)):
            proof = runtime.public_checks()
        self.assertFalse(next(row['ok'] for row in proof['pages'] if row['path'] == '/noa-music.php'))


if __name__ == '__main__':
    unittest.main()
