import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import n80_node_runtime as node


class NodeRuntimeTest(unittest.TestCase):
    def setUp(self):
        self.manifest = {'version':1, 'authority':'N80 Engine', 'nodeSha256':'a'*64,
                         'bundleSha256':'b'*64, 'nodeVersion':'v24.22.2', 'privateLibraries':True}
        self.receipt = {'version':1, 'authority':'N80 Engine', 'runtime':'node', 'ok':True,
                        'invocation':'c'*32, 'operation':'engine.status', 'nodeVersion':'v24.22.2',
                        'result':{'state':'verified', 'engine':'N80 Engine', 'generationRequests':0}}

    def test_manifest_rejects_stale_bundles_and_injected_paths(self):
        self.assertEqual(node.validate_manifest(self.manifest, 'b'*64), self.manifest)
        for changed in ({'bundleSha256':'d'*64}, {'nodeSha256':'../../anything'},
                        {'privateLibraries':'yes'}, {'nodeVersion':'v22.0.0'}):
            with self.assertRaises(RuntimeError):
                node.validate_manifest({**self.manifest, **changed}, 'b'*64)
        with self.assertRaises(RuntimeError):
            node.validate_manifest({**self.manifest, 'bundleSha256':'../escape'}, '../escape')
        command = node.command_for(self.manifest)
        self.assertTrue(command.startswith('exec ' + node.ROOT))
        self.assertNotIn('key', command)
        self.assertIn('--max-old-space-size=128', command)

    def test_receipt_requires_matching_invocation_version_operation_and_exit(self):
        def parse(value, code=0):
            return node.parse_receipt(json.dumps(value), code, 'engine.status', 'c'*32, self.manifest)
        self.assertEqual(parse(self.receipt)['result']['state'], 'verified')
        for change in ({'invocation':'d'*32}, {'operation':'ai.muvy'}, {'nodeVersion':'v24.1.0'},
                       {'ok':'true'}, {'result':{'state':'verified'}}):
            with self.assertRaises(RuntimeError): parse({**self.receipt, **change})
        with self.assertRaises(RuntimeError): parse(self.receipt, 1)
        with self.assertRaises(RuntimeError): parse([])

    def test_ssh_closes_on_output_limit_without_retry_or_credentials_in_command(self):
        class Channel:
            closed=False
            calls=0
            def settimeout(self, _): pass
            def exec_command(self, command):
                self.command=command;self.calls+=1
            def sendall(self, data): self.data=data
            def shutdown_write(self): pass
            def recv_ready(self): return True
            def recv_stderr_ready(self): return False
            def recv(self, _): return b'x'*20000
            def close(self): self.closed=True
        class Transport:
            def open_session(self, **_): return channel
        channel=Channel()
        with self.assertRaisesRegex(RuntimeError,'node_output_limit'):
            node.invoke(Transport(), self.manifest, 'engine.status', 'f'*64)
        self.assertTrue(channel.closed)
        self.assertEqual(channel.calls,1)
        self.assertNotIn('f'*64,channel.command)
        self.assertEqual(json.loads(channel.data)['key'],'f'*64)

    def test_host_failure_does_not_retry_locally_or_block_unrelated_media_queue(self):
        import noa_lab_worker
        from types import SimpleNamespace
        with patch.dict(sys.modules, {'noa_n80_ai_worker':SimpleNamespace(worker_key=lambda:b'f'*64)}), \
                patch.object(node, 'execute_muvy', side_effect=RuntimeError('uncertain')) as host, \
                patch('subprocess.run') as local:
            with self.assertRaisesRegex(RuntimeError,'n80_node_execution_unconfirmed'):
                noa_lab_worker.main()
        self.assertEqual(host.call_count,1)
        self.assertEqual(local.call_count,1)
        self.assertEqual(local.call_args.args[0],['node','lab/worker.mjs'])


if __name__ == '__main__': unittest.main()
