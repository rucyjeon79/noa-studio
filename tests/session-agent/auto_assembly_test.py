import base64
import hashlib
import importlib.util
import tempfile
import unittest
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('auto_edit', ROOT / 'scripts/noa_shorts_assembly.py')
edit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(edit)


class AutomaticEditing(unittest.TestCase):
    def setUp(self):
        self.audio = b'original audio'
        self.video = b'accepted motion'
        self.final = b'final movie' * 80000
        self.calls = []
        self.stored = bytearray()
        self.bad_source = False
        self.claim = {'id': 'a'*32, 'lease': 'b'*48, 'operationId': 'c'*32,
                      'manifest': {'audio': {'sha256': self.sha(self.audio)},
                                   'scenes': [{'n': 1, 'sha256': self.sha(self.video)}]}}

    @staticmethod
    def sha(data):
        return hashlib.sha256(data).hexdigest()

    def dispatch(self, command, **b):
        self.calls.append(command)
        for key in ('id', 'lease', 'operationId'):
            self.assertEqual(b[key], self.claim[key])
        if command == 'assembly_read':
            value = self.audio if b['kind'] == 'audio' else self.video
            data = b'corrupt audio!' if self.bad_source else value
            return {'sha256': self.sha(value), 'bytes': len(data), 'offset': 0,
                    'nextOffset': len(data), 'done': True, 'data': base64.b64encode(data).decode()}
        if command == 'assembly_write':
            block = base64.b64decode(b['data'], validate=True)
            offset = b['offset']
            if offset < len(self.stored):
                self.assertEqual(self.stored[offset:offset+len(block)], block)
            else:
                self.assertEqual(offset, len(self.stored))
                self.stored.extend(block)
            return {'done': len(self.stored) == len(self.final), 'nextOffset': len(self.stored),
                    'asset': {'sha256': self.sha(self.final)}}
        self.assertEqual(command, 'assembly_fail')
        return {'state': 'assembly_failed'}

    def renderer(self, manifest, folder):
        self.assertEqual(Path(manifest['audio']['path']).read_bytes(), self.audio)
        self.assertEqual(Path(manifest['scenes'][0]['path']).read_bytes(), self.video)
        output = folder / 'final.mp4'
        output.write_bytes(self.final)
        return output, {'bytes': len(self.final), 'sha256': self.sha(self.final), 'verification': {}}

    def test_actual_file_handoff_is_automatic_and_never_reviews(self):
        result = edit.assemble_claim(self.dispatch, self.claim, self.renderer)
        self.assertEqual(result['state'], 'final_review_required')
        self.assertEqual(self.stored, self.final)
        self.assertFalse(result['publicationReady'])
        self.assertTrue(set(self.calls) <= {'assembly_read', 'assembly_write'})

    def test_source_tampering_stops_before_render_or_upload(self):
        self.bad_source = True
        result = edit.assemble_claim(self.dispatch, self.claim, self.renderer)
        self.assertEqual(result['state'], 'assembly_failed')
        self.assertNotIn('assembly_write', self.calls)
        self.assertEqual(self.calls[-1], 'assembly_fail')

    def test_resumes_identical_partially_stored_output(self):
        self.stored.extend(self.final[:600000])
        result = edit.assemble_claim(self.dispatch, self.claim, self.renderer)
        self.assertEqual(result['state'], 'final_review_required')
        self.assertEqual(self.stored, self.final)

    def test_bad_output_receipt_cannot_be_uploaded(self):
        def bad(manifest, folder):
            output, receipt = self.renderer(manifest, folder)
            receipt['sha256'] = '0'*64
            return output, receipt
        self.assertEqual(edit.assemble_claim(self.dispatch, self.claim, bad)['state'], 'assembly_failed')
        self.assertNotIn('assembly_write', self.calls)

    def test_lost_host_response_keeps_lease_and_never_runs_local_fallback(self):
        from n80_media_runtime import HostRenderUnconfirmed
        calls = []
        def uncertain(manifest, folder):
            calls.append('host')
            raise HostRenderUnconfirmed()
        result = edit.assemble_claim(self.dispatch, self.claim, uncertain)
        self.assertEqual(result['state'], 'host_render_unconfirmed')
        self.assertTrue(result['leaseRetained'])
        self.assertEqual(calls, ['host'])
        self.assertNotIn('assembly_fail', self.calls)
        self.assertNotIn('assembly_write', self.calls)


if __name__ == '__main__':
    unittest.main()
