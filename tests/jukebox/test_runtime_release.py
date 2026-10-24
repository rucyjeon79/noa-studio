"""The runtime-only path cannot deploy source or stage hosting backups."""
import base64
import contextlib
import hashlib
import io
import os
from pathlib import Path
import stat
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import noa_jukebox_release as release


class ReadonlySFTP:
    def __init__(self):
        self.writes = 0

    def get_channel(self):
        return SimpleNamespace(settimeout=lambda value: None)

    def normalize(self, path):
        return path

    def lstat(self, path):
        return SimpleNamespace(st_mode=stat.S_IFREG | 0o644)

    def open(self, path, mode):
        if mode != 'rb':
            self.writes += 1
            raise AssertionError('Runtime worker attempted a hosting write')
        return io.BytesIO(b'k' * 64 if path.endswith('/worker.key') else b'protected')

    def close(self):
        pass


class Transport:
    def get_security_options(self):
        return SimpleNamespace(key_types=())

    def start_client(self, **kwargs):
        pass

    def get_remote_server_key(self):
        return SimpleNamespace(asbytes=lambda: b'unit-host-key')

    def auth_password(self, user, password):
        pass

    def set_keepalive(self, value):
        pass

    def open_session(self, **kwargs):
        raise OSError('exec unavailable')

    def close(self):
        pass


class RuntimeReleaseTests(unittest.TestCase):
    def test_missing_authentication_fails_before_network(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(release.paramiko, 'Transport') as connect:
            with self.assertRaisesRegex(RuntimeError, 'required_noa_ssh_secret_missing'):
                release.main()
            connect.assert_not_called()

    def test_push_runtime_worker_does_not_deploy_or_run_qa_without_drive_auth(self):
        fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(b'unit-host-key').digest()).decode().rstrip('=')
        env = {'NOA_SSH_HOST': 'unit.invalid', 'NOA_SSH_USER': 'unit',
               'NOA_SSH_PASSWORD': 'unit-only', 'NOA_SSH_HOST_FINGERPRINT': fingerprint,
               'NOA_JUKEBOX_RUNTIME_ONLY': '1', 'NOA_JUKEBOX_KEEPALIVE_SECONDS': '120',
               'GITHUB_EVENT_NAME': 'push', 'GITHUB_RUN_ID': '123', 'GITHUB_SHA': 'a' * 40}
        actions = []

        def call(action, payload=None):
            actions.append(action)
            if action == 'claim':
                return {'ids': []}
            if action == 'export':
                return {'items': [], 'catalog_song_records': 0, 'database_music_records': 0}
            if action == 'audit':
                return {'covers': 0, 'audio': 0, 'audio_bytes': 0}
            return {}

        server = ReadonlySFTP()
        cwd = Path.cwd()
        try:
            with tempfile.TemporaryDirectory() as temp, patch.dict(os.environ, env, clear=True), \
                    patch.object(release.paramiko, 'Transport', return_value=Transport()), \
                    patch.object(release.paramiko.SFTPClient, 'from_transport', return_value=server), \
                    patch.object(release, '_snapshot_sftp', side_effect=lambda s: s), \
                    patch.object(release, 'signed_service', return_value=call), \
                    patch.object(release, 'watchdog', return_value={}), \
                    patch.object(release, 'process_uploads', return_value=[]) as uploads, \
                    patch.object(release.shutil, 'which', return_value='/usr/bin/unit-tool'), \
                    contextlib.redirect_stdout(io.StringIO()) as output:
                os.chdir(temp)
                release.main()
                identity = uploads.call_args.args[-1]
                self.assertEqual(identity['keepalive_seconds'], 120)
                self.assertNotIn('k' * 64, output.getvalue())
        finally:
            os.chdir(cwd)
        self.assertEqual(server.writes, 0)
        self.assertNotIn('qa_setup', actions)
        self.assertNotIn('runtime_refresh', actions)
        self.assertEqual(actions[-1], 'finish')


if __name__ == '__main__':
    unittest.main()
