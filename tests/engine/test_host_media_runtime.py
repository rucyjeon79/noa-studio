import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from noa_host_media_runtime import interpret, execute, node_result


class HostRuntimeTest(unittest.TestCase):
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
