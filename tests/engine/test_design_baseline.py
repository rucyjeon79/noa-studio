"""A baseline must be actual stable remote bytes, never a local candidate fallback."""
import io
from pathlib import Path
import stat
import sys
from types import SimpleNamespace
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from n80_design_baseline import ROOT, read_asset


class Remote:
    def __init__(self, mode=stat.S_IFREG, changed=False, missing=False):
        self.mode, self.changed, self.missing = mode, changed, missing
        self.read = False
    def lstat(self, path):
        if self.missing:
            raise FileNotFoundError(path)
        return SimpleNamespace(st_mode=self.mode, st_size=3, st_mtime=2 if self.changed and self.read else 1)
    def normalize(self, path):
        return path
    def open(self, path, mode):
        assert path == ROOT + '/noa-ui.css' and mode == 'rb'
        self.read = True
        return io.BytesIO(b'old')


class BaselineTests(unittest.TestCase):
    def test_deployed_bytes_are_read(self):
        self.assertEqual(read_asset(Remote(), 'noa-ui.css'), b'old')
    def test_symlink_and_changed_snapshot_rejected(self):
        for remote in (Remote(mode=stat.S_IFLNK), Remote(changed=True)):
            with self.assertRaises(RuntimeError):
                read_asset(remote, 'noa-ui.css')
    def test_missing_asset_has_no_source_fallback(self):
        self.assertIsNone(read_asset(Remote(missing=True), 'noa-ui.css'))


if __name__ == '__main__':
    unittest.main()
