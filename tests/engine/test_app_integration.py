"""Guard the only existing-file replacement with Drive proof and exact version."""
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import n80_app_integration as runtime
from test_live_observer import Host, MemoryFile


class RuntimeHost(Host):
    def open(self, path, mode):
        if mode == 'wb':
            self.writes.append(path)
            return MemoryFile(b'', lambda data: self.files.__setitem__(path, data))
        return super().open(path, mode)


class IntegrationDeploymentTest(unittest.TestCase):
    def setUp(self):
        self.baseline = b'o' * 1148
        self.old_sha = runtime.sha(self.baseline)
        self.proof = {'sha256': self.old_sha, 'bytes': 1148,
                      'readbackVerified': True, 'driveId': 'verified-drive-file'}
        self.host = RuntimeHost()
        for rel in runtime.NEW_FILES:
            self.host.files[runtime.ROOT + '/' + rel] = (Path('deploy') / rel).read_bytes()
        self.target = runtime.ROOT + '/' + runtime.ADAPTER
        self.host.files[self.target] = self.baseline
        self.patches = [patch.object(runtime, 'OLD_SHA', self.old_sha),
                        patch.object(Path, 'read_text', return_value=json.dumps(self.proof)),
                        patch.object(runtime.subprocess, 'check_output', return_value=self.baseline),
                        patch.object(runtime.subprocess, 'run'),
                        patch.object(runtime, 'compare_sources', return_value={
                            'rows': [], 'allMatch': True, 'requiredCount': 29})]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

    def test_exact_preimage_changes_only_final_adapter_and_replay_is_read_only(self):
        first = runtime.install(self.host)
        self.assertEqual(first['changedFiles'], [runtime.ADAPTER])
        self.assertEqual(self.host.writes, [self.target])
        second = runtime.install(self.host)
        self.assertEqual(second['changedFiles'], [])

    def test_unknown_concurrent_version_is_preserved(self):
        self.host.files[self.target] = b'other work'
        with self.assertRaisesRegex(RuntimeError, 'concurrent_adapter_change'):
            runtime.install(self.host)
        self.assertEqual(self.host.files[self.target], b'other work')
        self.assertEqual(self.host.writes, [])

    def test_missing_drive_verification_blocks_before_any_host_write(self):
        self.proof['readbackVerified'] = False
        with patch.object(Path, 'read_text', return_value=json.dumps(self.proof)):
            with self.assertRaisesRegex(RuntimeError, 'verified_drive_preimage_required'):
                runtime.install(self.host)
        self.assertEqual(self.host.writes, [])


if __name__ == '__main__':
    unittest.main()
