import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

REPO = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('media_handoff', REPO / 'scripts/n80_media_handoff.py')
handoff = importlib.util.module_from_spec(spec)
spec.loader.exec_module(handoff)


class Sftp:
    def __init__(self, directory):
        self.base = Path(directory)
        self.path(handoff.ROOT).mkdir(parents=True, mode=0o700)
        self.race = False
        self.writes = 0

    def path(self, name): return self.base / name.removeprefix('/')
    def lstat(self, name): return self.path(name).lstat()
    def normalize(self, name):
        return '/' + self.path(name).resolve().relative_to(self.base.resolve()).as_posix()
    def open(self, name, mode):
        if 'w' in mode:
            self.writes += 1
            if self.race and name.startswith(handoff.POINTER + '.'):
                self.path(handoff.POINTER).write_text('concurrent')
        return self.path(name).open('xb' if mode == 'wx' else mode)
    def chmod(self, name, mode): self.path(name).chmod(mode)
    def mkdir(self, name, mode): self.path(name).mkdir(mode=mode)
    def remove(self, name): self.path(name).unlink()
    def posix_rename(self, a, b): os.replace(self.path(a), self.path(b))


class MediaHandoff(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.sftp = Sftp(self.temp.name)
        self.files = handoff.payload()

    def transfer(self, run_id='123'):
        return handoff.transfer(self.sftp, self.files, 'a' * 40, run_id)

    def test_source_bytes_arrive_with_no_runtime_activation(self):
        result = self.transfer()
        self.assertEqual(result['state'], 'source_verified_on_host')
        self.assertFalse(result['executionReady'])
        self.assertFalse(result['newWorker'])
        for name, data in self.files.items():
            target = handoff.ROOT + '/media-' + result['bundleSha256'] + '/' + name
            self.assertEqual(self.sftp.path(target).read_bytes(), data)
        self.assertEqual(json.loads(self.sftp.path(handoff.POINTER).read_text()), result)
        writes = self.sftp.writes
        self.transfer()
        self.assertEqual(self.sftp.writes, writes + 1)  # Receipt only; code is reused.

    def test_changed_remote_code_does_not_replace_receipt(self):
        result = self.transfer()
        previous = self.sftp.path(handoff.POINTER).read_bytes()
        target = handoff.ROOT + '/media-' + result['bundleSha256'] + '/' + handoff.FILES[0]
        self.sftp.path(target).write_bytes(b'corrupt')
        with self.assertRaisesRegex(ValueError, 'readback_mismatch'):
            self.transfer('124')
        self.assertEqual(self.sftp.path(handoff.POINTER).read_bytes(), previous)

    def test_stale_run_and_conflicting_same_run_preserve_receipt(self):
        self.transfer('124')
        with self.assertRaisesRegex(ValueError, 'stale_media'):
            self.transfer('123')
        self.files[handoff.FILES[0]] += b'\n'
        with self.assertRaisesRegex(ValueError, 'conflicting_media'):
            self.transfer('124')

    def test_concurrent_handoff_is_preserved(self):
        self.sftp.race = True
        with self.assertRaisesRegex(ValueError, 'concurrent_media'):
            self.transfer()
        self.assertEqual(self.sftp.path(handoff.POINTER).read_text(), 'concurrent')

    def test_symlink_is_not_followed(self):
        self.sftp.path(handoff.POINTER).symlink_to(self.sftp.path(handoff.ROOT) / 'missing')
        with self.assertRaisesRegex(ValueError, 'unsafe_media'):
            self.transfer()

    def test_extra_files_are_not_transferred(self):
        self.files['../../escape'] = b'bad'
        with self.assertRaisesRegex(ValueError, 'unregistered_media'):
            self.transfer()
        self.assertEqual(self.sftp.writes, 0)


if __name__ == '__main__':
    unittest.main()
