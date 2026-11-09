"""Reject incomplete remote tests and APKs differing from the host-tested inputs."""
import copy
import io
import json
from pathlib import Path
import sys
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from noa_android_host_bridge import NODE_SHA, digest, inputs, parse_tests, validate_proof, verify_apk


def receipt(bridge=b'bridge'):
    return {'schemaVersion': 1, 'authority': 'N80 Engine', 'module': 'jukebox',
            'operation': 'jukebox.android_bridge', 'executionTarget': 'existing_noa_host',
            'sourceCommit': 'a' * 40, 'nodeVersion': 'v24.22.2', 'nodeSha256': NODE_SHA,
            'bridgeSha256': digest(bridge), 'passed': True,
            'tests': {'tests': 16, 'pass': 16, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0}}


class HostNodeTest(unittest.TestCase):
    def test_only_complete_successful_tap_is_accepted(self):
        output = b'# tests 16\n# pass 16\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n'
        self.assertTrue(parse_tests(output, 0)['passed'])
        for altered, code in [(output, 1), (output + b'# tests 16\n', 0),
                              (output.replace(b'# skipped 0', b'# skipped 1'), 0),
                              (output.replace(b'# cancelled 0', b'# cancelled 1'), 0),
                              (output.replace(b'# pass 16', b'# pass 15'), 0),
                              (b'v24.22.2', 0)]:
            self.assertFalse(parse_tests(altered, code)['passed'])

    def test_receipt_is_bound_to_commit_bridge_runtime_and_tests(self):
        proof = receipt()
        validate_proof(proof, 'a' * 40, b'bridge')
        for field, value in [('sourceCommit', 'b' * 40), ('bridgeSha256', '0' * 64),
                             ('passed', False), ('nodeSha256', '0' * 64),
                             ('executionTarget', 'github_runner')]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_proof({**proof, field: value}, 'a' * 40, b'bridge')
        for key in ('fail', 'cancelled', 'skipped', 'todo'):
            altered = copy.deepcopy(proof)
            altered['tests'][key] = 1
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_proof(altered, 'a' * 40, b'bridge')

    def test_source_changes_after_host_check_are_rejected(self):
        proof = receipt()
        proof['inputs'] = {'bridge.js': digest(b'bridge')}
        validate_proof(proof, 'a' * 40, b'bridge', {'bridge.js': b'bridge'})
        with self.assertRaisesRegex(ValueError, 'source_changed'):
            validate_proof(proof, 'a' * 40, b'bridge', {'bridge.js': b'changed'})

    def test_signed_package_must_contain_same_bridge_and_receipt(self):
        proof = receipt()
        for bridge, embedded, expected in [(b'bridge', proof, True), (b'changed', proof, False),
                                          (b'bridge', {**proof, 'runId': 'different'}, False)]:
            package = io.BytesIO()
            with zipfile.ZipFile(package, 'w') as archive:
                archive.writestr('assets/noa-native-bridge.js', bridge)
                archive.writestr('assets/n80-android-bridge.json', json.dumps(embedded))
            package.seek(0)
            if expected:
                verify_apk(package, proof, 'a' * 40)
            else:
                with self.assertRaises(ValueError):
                    verify_apk(package, proof, 'a' * 40)

    def test_bundle_contains_native_package_and_excludes_credentials(self):
        payload = inputs()
        for path in (ROOT / 'android/app/src/main/java/kr/ai/noastudio').glob('*.java'):
            self.assertIn(path.relative_to(ROOT).as_posix(), payload)
        self.assertLess(sum(map(len, payload.values())), 1_000_000)
        self.assertFalse(any(p.endswith(('.p12', '.env')) or p.startswith('data/') for p in payload))


if __name__ == '__main__':
    unittest.main()
