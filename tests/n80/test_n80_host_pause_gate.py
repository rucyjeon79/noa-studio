"""N80 off-host execution must obey the hosting owner stop/pause latch."""
import io
import json
import stat
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from n80_host_pause_gate import ROOT, LIMIT, evaluate_control, sftp_control


class FakeSFTP:
    def __init__(self, data, regular=True, root=ROOT):
        self.data, self.regular, self.root = data, regular, root

    def normalize(self, path):
        return self.root

    def lstat(self, path):
        return SimpleNamespace(
            st_mode=stat.S_IFREG if self.regular else stat.S_IFLNK,
            st_size=len(self.data),
        )

    def open(self, path, mode):
        if mode != "rb":
            raise AssertionError("The pause gate must never open for write")
        return io.BytesIO(self.data)


def record(**updates):
    return json.dumps({"stop": False, "paused": False, "revision": 17, **updates}).encode()


class HostPauseGateTest(unittest.TestCase):
    def test_explicit_running_control_allows_external_one_shot(self):
        self.assertEqual(evaluate_control(record()), (True, "owner_control_allows_work"))

    def test_stopped_host_blocks_even_when_not_paused(self):
        self.assertEqual(evaluate_control(record(stop=True))[0], False)

    def test_paused_host_blocks_even_without_stop_latch(self):
        self.assertEqual(evaluate_control(record(paused=True))[0], False)

    def test_observed_production_stop_and_pause_both_block(self):
        self.assertEqual(evaluate_control(record(stop=True, paused=True, revision=17)),
                         (False, "owner_stop_or_pause_latched"))

    def test_missing_stop_or_pause_is_not_implicit_permission(self):
        self.assertFalse(evaluate_control(b'{"paused": false, "revision":17}')[0])
        self.assertFalse(evaluate_control(b'{"stop": false, "revision":17}')[0])

    def test_invalid_flags_cannot_enable_work(self):
        self.assertFalse(evaluate_control(record(stop=0))[0])
        self.assertFalse(evaluate_control(record(paused="false"))[0])

    def test_bad_revision_or_corrupt_control_blocks(self):
        self.assertFalse(evaluate_control(record(revision=True))[0])
        self.assertFalse(evaluate_control(record(revision=0))[0])
        self.assertFalse(evaluate_control(b"{broken")[0])

    def test_oversized_control_blocks(self):
        self.assertFalse(evaluate_control(b" " * (LIMIT + 1))[0])

    def test_regular_pinned_sftp_file_passes_without_write(self):
        self.assertEqual(sftp_control(FakeSFTP(record())), (True, "owner_control_allows_work"))

    def test_symlink_and_wrong_root_cannot_pass(self):
        with self.assertRaisesRegex(ValueError, "not_regular"):
            sftp_control(FakeSFTP(record(), regular=False))
        with self.assertRaisesRegex(ValueError, "root_changed"):
            sftp_control(FakeSFTP(record(), root="/hosting/other/noa-hub"))


if __name__ == "__main__":
    unittest.main()
