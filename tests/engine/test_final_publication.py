import hashlib
import io
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import n80_publish_final as subject


class Remote:
    def __init__(self):
        self.files = {}
        self.modes = {}
        self.fail_write = False
        self.unsafe_directory = False

    def __enter__(self): return self
    def __exit__(self, *args): pass
    def get_channel(self): return self
    def settimeout(self, value): pass
    def chmod(self, path, mode): self.modes[path] = mode
    def remove(self, path): del self.files[path]
    def lstat(self, path):
        if path in self.files:
            return SimpleNamespace(st_mode=stat.S_IFREG, st_size=len(self.files[path]))
        if path.endswith('.audio'):
            raise FileNotFoundError(path)
        return SimpleNamespace(st_mode=stat.S_IFLNK if self.unsafe_directory else stat.S_IFDIR)
    stat = lstat

    def open(self, path, mode):
        if mode == 'rb': return io.BytesIO(self.files[path])
        assert mode == 'wx'
        if path in self.files: raise FileExistsError(path)
        remote = self
        self.files[path] = b''
        class Upload(io.BytesIO):
            def write(self, value):
                remote.files[path] += value
                if remote.fail_write: raise OSError('disconnected')
                return len(value)
        return Upload()


class PublicationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / 'final.audio'
        self.source.write_bytes(b'complete-local-output')
        digest = hashlib.sha256(self.source.read_bytes()).hexdigest()
        self.request = {'id': 'a'*32, 'file': 'optimized-'+digest+'.audio',
                        'path': str(self.source), 'sha256': digest}
        self.remote = Remote()

    def publish(self):
        with patch.object(subject, 'connect', return_value=SimpleNamespace(close=lambda: None)), \
             patch.object(subject.paramiko.SFTPClient, 'from_transport', return_value=self.remote):
            return subject.publish(self.request)

    def test_final_readback_and_exact_replay(self):
        first = self.publish()
        self.assertEqual(first, self.publish())
        self.assertEqual(len(self.remote.files), 1)
        self.assertEqual(list(self.remote.files.values()), [self.source.read_bytes()])
        self.assertEqual(list(self.remote.modes.values()), [0o600])

    def test_interrupted_transfer_removes_only_its_own_new_file(self):
        self.remote.fail_write = True
        with self.assertRaises(OSError): self.publish()
        self.assertEqual(self.remote.files, {})

    def test_existing_conflicting_final_is_not_overwritten_or_removed(self):
        self.publish()
        path = next(iter(self.remote.files))
        self.remote.files[path] = b'x' * self.source.stat().st_size
        with self.assertRaisesRegex(ValueError, 'final_readback_mismatch'): self.publish()
        self.assertEqual(self.remote.files[path], b'x' * self.source.stat().st_size)

    def test_unsafe_directory_and_local_checksum_stop_publication(self):
        self.remote.unsafe_directory = True
        with self.assertRaisesRegex(ValueError, 'unsafe_final_directory'): self.publish()
        self.remote.unsafe_directory = False
        self.source.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'local_final_checksum_mismatch'): self.publish()
        self.assertEqual(self.remote.files, {})


if __name__ == '__main__': unittest.main()
