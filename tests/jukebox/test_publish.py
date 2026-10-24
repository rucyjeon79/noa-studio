import hashlib
import io
from pathlib import Path
import stat
import sys
import tempfile
from types import SimpleNamespace
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from noa_jukebox_publish import publish_final


class RemoteWrite(io.BytesIO):
    def __init__(self, server, path):
        super().__init__()
        self.server, self.path = server, path

    def close(self):
        if not self.closed:
            self.server.files[self.path] = self.getvalue()
        super().close()


class SFTP:
    def __init__(self):
        self.files = {}
        self.renames = []
        self.corrupt_stage_reads = False
        self.publish_race = False
        self.bad_directory = False

    def normalize(self, path):
        return '/different' if self.bad_directory else path

    def lstat(self, path):
        if path not in self.files:
            raise FileNotFoundError(path)
        return SimpleNamespace(st_mode=stat.S_IFREG | 0o600,
                               st_size=len(self.files[path]))

    def open(self, path, mode):
        if mode == 'rb':
            data = self.files[path]
            if '.stage-' in path and self.corrupt_stage_reads:
                data = bytes([data[0] ^ 1]) + data[1:]
            return io.BytesIO(data)
        if mode != 'wx':
            raise AssertionError('Publication must create exclusively')
        if path in self.files:
            raise FileExistsError(path)
        self.files[path] = b''
        return RemoteWrite(self, path)

    def chmod(self, path, mode):
        pass

    def rename(self, source, target):
        if self.publish_race:
            self.files[target] = b'concurrent-worker-media'
        if target in self.files:
            raise FileExistsError(target)
        self.files[target] = self.files.pop(source)
        self.renames.append((source, target))

    def remove(self, path):
        if path not in self.files:
            raise FileNotFoundError(path)
        del self.files[path]


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.local = Path(self.folder.name) / 'final.mp3'
        self.data = b'already-encoded-and-verified-final-mp3'
        self.local.write_bytes(self.data)
        self.digest = hashlib.sha256(self.data).hexdigest()
        self.target = '/hosting/noastudio/noa-jukebox-private/media/K-POP/final.mp3'
        self.sftp = SFTP()

    def tearDown(self):
        self.folder.cleanup()

    def publish(self):
        return publish_final(self.sftp, self.local, self.target,
                             self.digest, owner='123')

    def test_complete_readback_precedes_activation_and_no_stage_remains(self):
        result = self.publish()
        self.assertTrue(result['readback_verified'])
        self.assertTrue(result['created'])
        self.assertEqual(self.sftp.files, {self.target: self.data})
        self.assertEqual(len(self.sftp.renames), 1)

    def test_corrupt_upload_is_not_published_and_only_owned_stage_is_removed(self):
        other = self.target + '.stage-other-worker'
        self.sftp.files[other] = b'active-work'
        self.sftp.corrupt_stage_reads = True
        with self.assertRaisesRegex(ValueError, 'upload_hash_mismatch'):
            self.publish()
        self.assertEqual(self.sftp.files, {other: b'active-work'})
        self.assertEqual(self.sftp.renames, [])

    def test_existing_edition_is_never_overwritten(self):
        self.sftp.files[self.target] = b'different-edition'
        with self.assertRaises(ValueError):
            self.publish()
        self.assertEqual(self.sftp.files[self.target], b'different-edition')
        self.assertEqual(self.sftp.renames, [])

    def test_matching_existing_media_is_verified_without_writing(self):
        self.sftp.files[self.target] = self.data
        self.assertFalse(self.publish()['created'])
        self.assertEqual(self.sftp.files, {self.target: self.data})
        self.assertEqual(self.sftp.renames, [])

    def test_concurrent_final_file_is_preserved_and_our_stage_is_removed(self):
        self.sftp.publish_race = True
        with self.assertRaises(FileExistsError):
            self.publish()
        self.assertEqual(self.sftp.files,
                         {self.target: b'concurrent-worker-media'})

    def test_noncanonical_parent_is_rejected_before_writing(self):
        self.sftp.bad_directory = True
        with self.assertRaisesRegex(ValueError, 'unsafe_media_directory'):
            self.publish()
        self.assertEqual(self.sftp.files, {})


if __name__ == '__main__':
    unittest.main()
