import sys
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from noa_host_media_runtime import interpret, execute, node_result, checksum_result, verify_remote_file, write_evidence
from unittest.mock import patch
from noa_host_browser_runtime import browser_result, VERIFY


class HostRuntimeTest(unittest.TestCase):
    def test_interrupted_startup_retains_the_last_phase_without_claiming_readiness(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/'proof/runtime.json'
            result = {'productionReady':False, 'authenticatedProvider':False}
            write_evidence(result, 'host_connection', path)
            write_evidence(result, 'node_verification', path)
            saved = json.loads(path.read_text())
            self.assertEqual(saved['phase'], 'node_verification')
            self.assertFalse(saved['productionReady'])
            self.assertFalse(saved['authenticatedProvider'])
            self.assertFalse(path.with_suffix('.tmp').exists())

    def test_remote_integrity_verifier_rejects_modified_bytes_and_path_escape(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root/'verify.cjs').write_text(VERIFY)
            (root/'bundle').mkdir()
            (root/'bundle/asset').write_bytes(b'actual bytes')
            def verify(name):
                body = json.dumps({name: {'bytes': 12, 'sha256': hashlib.sha256(b'actual bytes').hexdigest()}}).encode()
                (root/'manifest').write_bytes(body)
                run = subprocess.run(['node', str(root/'verify.cjs'), str(root/'bundle'), str(root/'manifest'), hashlib.sha256(body).hexdigest()], capture_output=True, text=True, timeout=5)
                return run.returncode, json.loads(run.stdout)['verified']
            self.assertEqual(verify('asset'), (0, True))
            (root/'bundle/asset').write_bytes(b'changed data')
            self.assertEqual(verify('asset'), (1, False))
            (root/'escape').write_bytes(b'actual bytes')
            self.assertEqual(verify('../escape'), (1, False))

    def test_remote_checksum_verifies_bytes_without_downloading_or_trusting_exit_alone(self):
        digest='a'*64
        self.assertEqual(checksum_result((digest+'  /fixed/file\n').encode(),0),{'available':True,'sha256':digest})
        self.assertFalse(checksum_result(b'not a hash',0)['available'])
        self.assertFalse(checksum_result((digest+'  /fixed/file\n').encode(),1)['available'])
        with patch('noa_host_media_runtime.execute',return_value={'available':True,'sha256':digest}):
            self.assertTrue(verify_remote_file(None,None,'/fixed/file',100,digest))
            self.assertFalse(verify_remote_file(None,None,'/fixed/file',100,'b'*64))

    def test_browser_receipt_requires_successful_exit_and_real_boolean(self):
        self.assertTrue(browser_result(b'{"state":"host_browser_started","browserStarted":true}', 0)['browserStarted'])
        for output, code in [(b'{"state":"host_browser_started","browserStarted":true}', 1),
                             (b'{"state":"host_browser_started","browserStarted":"true"}', 0),
                             (b'not JSON', 0)]:
            self.assertFalse(browser_result(output, code)['browserStarted'])

    def test_browser_sandbox_failure_is_not_retried_with_protection_disabled(self):
        result = browser_result(b'{"state":"host_browser_sandbox_unavailable","browserStarted":false}', 1)
        self.assertEqual(result['state'], 'host_browser_sandbox_unavailable')
        self.assertFalse(result['browserStarted'])

    def test_node_install_requires_a_real_successful_version_response(self):
        self.assertTrue(node_result(b'v24.12.0\n', 0)['started'])
        for output, code in [(b'v24.12.0', 1), (b'v20.0.0', 0), (b'permission denied', 0)]:
            self.assertFalse(node_result(output, code)['started'])

    def test_node_start_error_never_exposes_remote_paths(self):
        result = node_result(b'/private/path/node: Permission denied', 126)
        self.assertEqual(result['reason'], 'execution_denied')
        self.assertNotIn('/private/path', str(result))

    def test_sftp_access_is_not_shell_execution(self):
        result = interpret(b'This service allows sftp connections only.\n', 1)
        self.assertEqual(result['state'], 'host_sftp_only')
        self.assertFalse(result['browserStarted'])

    def test_installed_browser_does_not_prove_it_started(self):
        result = interpret(b'N80_HOST_EXEC_V1\ntool=chromium\nN80_HOST_EXEC_END\n', 0)
        self.assertTrue(result['shellExecuted'])
        self.assertFalse(result['browserStarted'])

    def test_incomplete_or_failed_command_cannot_claim_browser_success(self):
        for output, code in [(b'N80_HOST_EXEC_V1\nbrowser_started=1\n', 0),
                             (b'N80_HOST_EXEC_V1\nbrowser_started=1\nN80_HOST_EXEC_END\n', 1)]:
            self.assertFalse(interpret(output, code)['browserStarted'])

    def test_real_success_ignores_unexpected_remote_output(self):
        result = interpret(b'N80_HOST_EXEC_V1\ntool=node\nnode_started=1\nbrowser_started=1\ntool=private-value\nN80_HOST_EXEC_END\n', 0)
        self.assertTrue(result['browserStarted'])
        self.assertEqual(result['tools'], ['node'])
        self.assertNotIn('private-value', str(result))

    def test_rejected_channel_is_closed_and_error_text_is_not_logged(self):
        class Channel:
            closed = False
            def settimeout(self, _): pass
            def exec_command(self, _): raise RuntimeError('secret connection details')
            def close(self): self.closed = True
        channel = Channel()
        class Transport:
            def open_session(self, **_): return channel
        result = execute(Transport())
        self.assertEqual(result['state'], 'host_exec_channel_rejected')
        self.assertTrue(channel.closed)
        self.assertNotIn('secret', str(result))


if __name__ == '__main__':
    unittest.main()
