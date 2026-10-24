"""Exact operating preimages, guarded atomic writes and selective rollback."""
import base64
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import sys
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('finish_release', ROOT/'scripts/noa_category_release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def archive_bytes(old, extra=None):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w:gz') as archive:
        for path, data in old.items():
            if data is None:
                continue
            member = tarfile.TarInfo(path)
            member.size = len(data)
            archive.addfile(member, io.BytesIO(data))
        if extra:
            archive.addfile(extra)
    return output.getvalue()


def receipt_for(old, raw):
    return {'files': {p: None if data is None else {'bytes': len(data), 'sha256': release.sha(data)}
                      for p, data in old.items()},
            'protected': {}, 'archiveSha256': release.sha(raw),
            'driveId': 'verified_unit_drive', 'readbackVerified': True,
            'restoreExtractionVerified': True, 'checkpointRun': 40096706561,
            'artifactId': 12560554889}


class PreimageTests(unittest.TestCase):
    def test_operating_view_is_restored_from_archive_without_git_history(self):
        old = {p: None for p in release.FILES}
        target = next(iter(release.FILES))
        old[target] = b'<?php // Exact operating preimage absent from git\n'
        raw = archive_bytes(old)
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'preimages.tar.gz'
            path.write_bytes(raw)
            with patch('subprocess.check_output', side_effect=AssertionError('git cannot provide HOME')):
                self.assertEqual(release.load_preimages(receipt_for(old, raw), path),
                                 {target: old[target]})

    def test_archive_hash_must_equal_drive_receipt(self):
        old = {p: None for p in release.FILES}
        raw = archive_bytes(old)
        record = receipt_for(old, raw)
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'preimages.tar.gz'
            path.write_bytes(raw+b'changed')
            with self.assertRaisesRegex(RuntimeError, 'archive_hash_mismatch'):
                release.load_preimages(record, path)

    def test_unexpected_archive_path_is_rejected_without_extraction(self):
        old = {p: None for p in release.FILES}
        extra = tarfile.TarInfo('../../private-key')
        raw = archive_bytes(old, extra)
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'preimages.tar.gz'
            path.write_bytes(raw)
            with self.assertRaisesRegex(RuntimeError, 'unexpected_recovery_archive_member'):
                release.load_preimages(receipt_for(old, raw), path)
            self.assertEqual(list(Path(temp).iterdir()), [path])


class Write(io.BytesIO):
    def __init__(self, server, path):
        super().__init__()
        self.server, self.path = server, path

    def write(self, data):
        if self.server.fail_stage and self.path.startswith(self.server.fail_stage + '.noa-'):
            self.server.fail_stage = None
            super().write(data[:3])
            raise OSError('simulated interrupted upload')
        return super().write(data)

    def close(self):
        if not self.closed:
            self.server.files[self.path] = self.getvalue()
        super().close()


class SFTP:
    def __init__(self, old):
        self.files = {release.ROOT+'/'+p: data for p, data in old.items() if data is not None}
        self.directories = {release.ROOT: 0o755, release.COMPLETION_STORE.rsplit('/', 1)[0]: 0o700}
        self.fail_stage = None
        self.removed = []
        self.renamed = []

    def get_channel(self):
        return SimpleNamespace(settimeout=lambda _: None)

    def normalize(self, path):
        return path

    def lstat(self, path):
        if path in self.directories:
            return SimpleNamespace(st_mode=stat.S_IFDIR | self.directories[path])
        if path not in self.files:
            raise FileNotFoundError(path)
        return SimpleNamespace(st_mode=stat.S_IFREG | 0o644)

    def mkdir(self, path, mode):
        if path in self.directories:
            raise FileExistsError(path)
        self.directories[path] = mode

    def open(self, path, mode):
        if mode == 'rb':
            return io.BytesIO(self.files[path])
        if mode != 'wx':
            raise AssertionError('All staged writes must create exclusively')
        if path in self.files:
            raise FileExistsError(path)
        self.files[path] = b''
        return Write(self, path)

    def chmod(self, path, mode):
        pass

    def posix_rename(self, source, target):
        self.files[target] = self.files.pop(source)
        self.renamed.append(target)

    def rename(self, source, target):
        if target in self.files:
            raise FileExistsError(target)
        self.posix_rename(source, target)

    def remove(self, path):
        if path not in self.files:
            raise FileNotFoundError(path)
        del self.files[path]
        self.removed.append(path)

    def close(self):
        pass


class Transport:
    def get_security_options(self): return SimpleNamespace(key_types=())
    def start_client(self, **kwargs): pass
    def get_remote_server_key(self): return SimpleNamespace(asbytes=lambda: b'unit-host-key')
    def auth_password(self, user, password): pass
    def close(self): pass


class DeploymentTests(unittest.TestCase):
    def test_completion_directory_rejects_existing_public_permissions(self):
        server = SFTP({})
        server.directories[release.COMPLETION_STORE] = 0o755
        with self.assertRaisesRegex(RuntimeError, 'unsafe_completion_directory'):
            release.ensure_completion_store(server)
        self.assertEqual(server.directories[release.COMPLETION_STORE], 0o755)

    def test_completion_directory_is_created_private(self):
        server = SFTP({})
        self.assertTrue(release.ensure_completion_store(server))
        self.assertEqual(server.directories[release.COMPLETION_STORE], 0o700)

    def test_failed_atomic_upload_skips_unchanged_old_target_and_restores_prior_file(self):
        old = {p: ('operating '+p).encode() for p in release.FILES}
        server = SFTP(old)
        server.fail_stage = release.ROOT+'/'+release.ORDER[1]
        raw = archive_bytes(old)
        record = receipt_for(old, raw)
        key = 'common.php'
        server.files[release.ROOT+'/'+key] = b'protected-core'
        record['protected'][key] = {'bytes': 14, 'sha256': release.sha(b'protected-core')}
        cwd = Path.cwd()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root/'archive.tar.gz'; archive.write_bytes(raw)
            receipt = root/'receipt.json'; receipt.write_text(json.dumps(record))
            for remote, source in release.FILES.items():
                path = root/source; path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(('candidate '+remote).encode())
            env = {'NOA_SSH_HOST': 'unit.invalid', 'NOA_SSH_USER': 'unit', 'NOA_SSH_PASSWORD': 'unit-only',
                   'NOA_SSH_HOST_FINGERPRINT': 'SHA256:'+base64.b64encode(hashlib.sha256(b'unit-host-key').digest()).decode().rstrip('='),
                   'GITHUB_SHA': 'a'*40, 'NOA_FINISH_PREIMAGE_ARCHIVE': str(archive)}
            try:
                os.chdir(root)
                with patch.dict(os.environ, env, clear=True), patch.object(release, 'RECEIPT', receipt), \
                     patch.object(release, 'STATE', root/'state.json'), patch.object(release.sys, 'argv', ['release']), \
                     patch.object(release.paramiko, 'Transport', return_value=Transport()), \
                     patch.object(release.paramiko.SFTPClient, 'from_transport', return_value=server), \
                     patch.object(release, 'snapshot', return_value={}), contextlib.redirect_stdout(io.StringIO()):
                    with self.assertRaisesRegex(OSError, 'interrupted upload'):
                        release.main()
                state = json.loads((root/'state.json').read_text())
            finally:
                os.chdir(cwd)
        self.assertTrue(state['rolled_back'])
        for path, data in old.items():
            self.assertEqual(server.files[release.ROOT+'/'+path], data)
        self.assertFalse(any('.noa-' in path for path in server.files))
        self.assertNotIn(release.ROOT+'/'+release.ORDER[1], server.renamed)
        self.assertEqual(server.files[release.ROOT+'/'+key], b'protected-core')


if __name__ == '__main__':
    unittest.main()
