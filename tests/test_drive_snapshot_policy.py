import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from noa_drive_snapshot import DriveStore, SnapshotSFTP


class LiveSFTP:
    def __init__(self):
        self.calls = []

    def mkdir(self, *args):
        self.calls.append(('mkdir', args))

    def open(self, *args):
        raise AssertionError('snapshot bytes reached hosting')


class VerifiedStore:
    def __init__(self, fail=False):
        self.saved = []
        self.fail = fail

    def require(self):
        pass

    def publish(self, path, local):
        if self.fail:
            raise RuntimeError('drive_readback_failed')
        self.saved.append((path, local.read_bytes()))


class SnapshotPolicyTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'RUNNER_TEMP': self.temp.name, 'NOA_DRIVE_RCLONE_CONFIG_B64': ''})
        self.env.start()
        self.path = '/hosting/noastudio/noa-deploy-backups/p0-test'

    def tearDown(self):
        self.env.stop()
        self.temp.cleanup()

    def test_snapshot_never_written_to_host_and_rollback_can_read_it(self):
        live, store = LiveSFTP(), VerifiedStore()
        s = SnapshotSFTP(live, store)
        s.mkdir(self.path, 0o700)
        with s.open(self.path + '/old.php', 'wx') as f:
            f.write(b'old version')
        self.assertEqual(store.saved, [(self.path + '/old.php', b'old version')])
        with s.open(self.path + '/old.php', 'rb') as f:
            f.prefetch(file_size=11, max_concurrent_requests=8)
            self.assertEqual(f.read(), b'old version')
        self.assertEqual(live.calls, [])

    def test_missing_drive_auth_blocks_before_host_backup_creation(self):
        live = LiveSFTP()
        with self.assertRaisesRegex(RuntimeError, 'AUTH_MISSING'):
            SnapshotSFTP(live, DriveStore()).mkdir(self.path)
        self.assertEqual(live.calls, [])

    def test_failed_cloud_verification_propagates_before_caller_can_continue(self):
        live = LiveSFTP()
        s = SnapshotSFTP(live, VerifiedStore(fail=True))
        s.mkdir(self.path)
        with self.assertRaisesRegex(RuntimeError, 'drive_readback_failed'):
            with s.open(self.path + '/old.php', 'wx') as f:
                f.write(b'original')
        self.assertEqual(live.calls, [])

    def test_deployment_lock_is_kept_on_host(self):
        live = LiveSFTP()
        SnapshotSFTP(live, VerifiedStore()).mkdir('/hosting/noastudio/noa-deploy-backups/.work-deploy-lock', 0o700)
        self.assertEqual(len(live.calls), 1)


if __name__ == '__main__':
    unittest.main()
