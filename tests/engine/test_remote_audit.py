"""Exercise drift, optional diagnostics and the zero-write SFTP contract."""
import importlib.util
import io
import stat
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

SPEC = importlib.util.spec_from_file_location(
    'audit', Path(__file__).resolve().parents[2] / 'scripts/n80_guardian_remote_audit.py')
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)


class ReadOnlySFTP:
    def __init__(self, files):
        self.files = files

    def normalize(self, path):
        return path

    def lstat(self, path):
        value = self.files[path]
        if value is None:
            return SimpleNamespace(st_mode=stat.S_IFLNK)
        return SimpleNamespace(st_mode=stat.S_IFREG)

    def open(self, path, mode):
        if mode != 'rb':
            raise AssertionError('host write attempted')
        return io.BytesIO(self.files[path])


class AuditTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        for path in ['noa-app/engine/n80.php', 'noa-app/engine/receipt-contract.php',
                     'noa-app/engine/new-runtime-module.php',
                     'noa-app/engine/performance.php', 'noa-app/jukebox/cli.php']:
            target = self.base / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(path.encode())
        self.files = {audit.ROOT + '/' + path: (self.base / path).read_bytes()
                      for path, _ in audit.source_inventory(self.base)}

    def check(self):
        # Convert dictionary KeyError to the actual SFTP missing-file exception.
        class MissingAware(ReadOnlySFTP):
            def lstat(self, path):
                if path not in self.files:
                    raise FileNotFoundError(path)
                return super().lstat(path)
        return audit.compare_sources(MissingAware(self.files), self.base)

    def test_discovers_receipt_cli_and_new_module_without_allowlist_edit(self):
        result = self.check()
        self.assertTrue(result['allMatch'])
        self.assertEqual(result['requiredCount'], 4)
        self.assertEqual(result['hostWrites'], 0)
        self.assertFalse(result['runtimeExecutionVerified'])

    def test_missing_required_and_changed_cli_fail(self):
        self.files.pop(audit.ROOT + '/noa-app/engine/receipt-contract.php')
        self.files[audit.ROOT + '/noa-app/jukebox/cli.php'] = b'unknown edit'
        result = self.check()
        self.assertFalse(result['allMatch'])
        self.assertEqual({'missing', 'different'},
                         {r['state'] for r in result['rows'] if r['state'] != 'match'})

    def test_undeployed_diagnostic_is_optional_but_deployed_drift_fails(self):
        key = audit.ROOT + '/noa-app/engine/performance.php'
        self.files.pop(key)
        self.assertTrue(self.check()['allMatch'])
        self.files[key] = b'unknown edit'
        self.assertFalse(self.check()['allMatch'])

    def test_symlink_rejected(self):
        self.files[audit.ROOT + '/noa-app/engine/n80.php'] = None
        self.assertFalse(self.check()['allMatch'])


if __name__ == '__main__':
    unittest.main()
