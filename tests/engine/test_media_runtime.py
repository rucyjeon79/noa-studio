import contextlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch, Mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
import n80_media_runtime as media


class HostMedia(unittest.TestCase):
    def active(self):
        return dict(schemaVersion=1, authority='N80 Engine', module='ai_lab', state='host_media_verified',
                    bundleId='a'*64, manifestSha256='b'*64, sourceHashes=media.source_hashes())

    def test_stale_code_and_source_only_receipts_cannot_activate(self):
        value = self.active()
        self.assertEqual(media.media_manifest(value), value)
        for changed in ({'state': 'source_verified_on_host'}, {'sourceHashes': {}}, {'bundleId': '../../other'}):
            with self.assertRaisesRegex(ValueError, 'not_current'):
                media.media_manifest({**value, **changed})

    def test_uncertain_host_keeps_job_for_recovery_and_does_not_retry(self):
        for outcome in ({'state': 'host_command_timeout'}, ConnectionError('lost response')):
            with self.subTest(outcome=type(outcome).__name__), tempfile.TemporaryDirectory() as directory, contextlib.ExitStack() as stack:
                folder = Path(directory)
                audio = folder / 'source'; audio.write_bytes(b'original audio')
                clip = folder / 'clip'; clip.write_bytes(b'accepted clip')
                stack.enter_context(patch.object(media, 'connection', lambda: contextlib.nullcontext((Mock(), Mock()))))
                stack.enter_context(patch.object(media, 'node_args', return_value=['node']))
                stack.enter_context(patch.object(media, 'read', return_value=json.dumps(self.active()).encode()))
                for name in ('verify', 'mkdir', 'put', 'capacity'):
                    stack.enter_context(patch.object(media, name))
                invoke = stack.enter_context(patch.object(media, 'invoke', **({'side_effect': outcome} if isinstance(outcome, Exception) else {'return_value': outcome})))
                cleanup = stack.enter_context(patch('noa_host_browser_runtime.remove_profile'))
                with self.assertRaises(media.HostRenderUnconfirmed):
                    media.render({'audio': {'path': str(audio)}, 'scenes': [{'n': 1, 'path': str(clip)}]}, folder)
                invoke.assert_called_once()
                cleanup.assert_not_called()

    def test_invalid_json_and_nonzero_exit_never_confirm_execution(self):
        self.assertFalse(media.result(b'not-json', 0)['ok'])
        self.assertFalse(media.result(b'{"ok":true,"state":"host_media_rendered"}', 1)['ok'])
        self.assertTrue(media.result(b'{"verified":true}', 0)['ok'])


if __name__ == '__main__':
    unittest.main()
