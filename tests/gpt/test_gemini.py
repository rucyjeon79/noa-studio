import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'integrations/private-worker'))
import gemini

class GeminiTests(unittest.TestCase):
    def test_cached_credentials_cannot_activate_retired_provider(self):
        with patch.dict(os.environ, {'GEMINI_CLI_HOME': '/old/login',
                'GEMINI_API_KEY': 'must-not-use', 'NOA_GEMINI_OAUTH': 'must-not-read'}), \
                patch('pathlib.Path.read_text', side_effect=AssertionError('credential read')), \
                patch('subprocess.run', side_effect=AssertionError('provider launched')):
            self.assertFalse(gemini.login_present())
            self.assertEqual(gemini.verify(), {'connected': False,
                'state': 'gemini_consumer_cli_retired', 'capabilities': []})

    def test_fake_response_cannot_register_capability(self):
        with patch.object(gemini, 'complete') as call:
            self.assertFalse(gemini.verify(call)['connected'])
            call.assert_not_called()

    def test_retired_provider_never_consumes_song_data(self):
        with patch('subprocess.run', side_effect=AssertionError('provider launched')):
            self.assertEqual(gemini.review({'song': {'title': 'private'}}, 'review'),
                {'ok': False, 'error': 'gemini_consumer_cli_retired'})
            with self.assertRaisesRegex(RuntimeError, 'gemini_consumer_cli_retired'):
                gemini.complete('private prompt')

if __name__ == '__main__': unittest.main()
