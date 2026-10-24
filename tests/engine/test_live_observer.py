"""Verify additive deployment cannot stage or overwrite production files."""
import importlib.util
import io
from pathlib import Path
import stat
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import n80_live_observer as runtime


class MemoryFile(io.BytesIO):
    def __init__(self, data, callback=None):
        super().__init__(data)
        self.callback = callback

    def close(self):
        if self.callback and not self.closed:
            self.callback(self.getvalue())
        super().close()


class Host:
    def __init__(self):
        self.files = {}
        self.writes = []

    def normalize(self, path):
        return path

    def lstat(self, path):
        if path == runtime.ROOT + '/noa-app/engine':
            return SimpleNamespace(st_mode=stat.S_IFDIR)
        if path not in self.files:
            raise FileNotFoundError(path)
        return SimpleNamespace(st_mode=stat.S_IFREG)

    def open(self, path, mode):
        if mode == 'rb':
            return MemoryFile(self.files[path])
        if mode != 'wx' or path in self.files:
            raise AssertionError('overwrite or unsafe open')
        self.writes.append(path)
        return MemoryFile(b'', lambda data: self.files.__setitem__(path, data))

    def chmod(self, *args):
        pass


class DeploymentTest(unittest.TestCase):
    def test_only_final_names_are_created_and_repeat_is_read_only(self):
        host = Host()
        healthy = {'rows': [], 'allMatch': True, 'requiredCount': 27}
        with patch.object(runtime, 'compare_sources', return_value=healthy):
            first, count = runtime.install_finished(host)
            second, _ = runtime.install_finished(host)
        self.assertEqual(tuple(first), runtime.FILES)
        self.assertEqual(second, [])
        self.assertEqual(count, 27)
        self.assertEqual(host.writes, [runtime.ROOT + '/' + p for p in runtime.FILES])

    def test_existing_unknown_version_is_never_overwritten(self):
        host = Host()
        path = runtime.ROOT + '/' + runtime.FILES[0]
        host.files[path] = b'other work'
        healthy = {'rows': [], 'allMatch': True, 'requiredCount': 27}
        with patch.object(runtime, 'compare_sources', return_value=healthy):
            with self.assertRaisesRegex(RuntimeError, 'runtime_version_conflict'):
                runtime.install_finished(host)
        self.assertEqual(host.files[path], b'other work')
        self.assertEqual(host.writes, [])

    def test_unrelated_drift_blocks_before_any_new_file(self):
        host = Host()
        drift = {'rows': [{'module': 'noa-app/engine/policy.php', 'required': True,
                           'state': 'different'}], 'allMatch': False}
        with patch.object(runtime, 'compare_sources', return_value=drift):
            with self.assertRaisesRegex(RuntimeError, 'production_version_conflict'):
                runtime.install_finished(host)
        self.assertEqual(host.writes, [])


if __name__ == '__main__':
    unittest.main()
