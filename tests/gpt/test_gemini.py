import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'integrations/private-worker'))
import gemini

class GeminiTests(unittest.TestCase):
    def test_missing_login_never_calls_provider(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(gemini, 'complete') as call:
            self.assertEqual(gemini.verify()['state'], 'gemini_login_required')
            call.assert_not_called()

    def test_probe_requires_real_exact_response(self):
        with patch.object(gemini, 'login_present', return_value=True):
            good = gemini.verify(lambda p: p.split(': ')[-1])
            self.assertTrue(good['connected'])
            self.assertEqual(good['capabilities'], ['text_review'])
            self.assertFalse(gemini.verify(lambda p: 'connected!')['connected'])

    def test_inference_has_no_worker_secrets_or_tools(self):
        with patch.dict(os.environ, {'NOA_WORKER_KEY':'never-send','GH_TOKEN':'never-send',
                'GEMINI_API_KEY':'never-send','GEMINI_CLI_HOME':'/isolated/login'}), \
                patch.object(gemini, 'login_present', return_value=True):
            def run(args, **kw):
                self.assertIn('--admin-policy', args)
                self.assertIn('decision = "deny"', Path(args[-1]).read_text())
                self.assertFalse(set(kw['env']) & {'NOA_WORKER_KEY','GH_TOKEN','GEMINI_API_KEY','CODEX_HOME'})
                self.assertNotIn('--yolo', args)
                return subprocess.CompletedProcess(args, 0, json.dumps({'response':'feedback'}), '')
            with patch('gemini.subprocess.run', side_effect=run):
                self.assertEqual(gemini.complete('reference'), 'feedback')

    def test_specialist_failure_is_observation_not_fake_content(self):
        with patch.object(gemini, 'complete', side_effect=RuntimeError('private error')):
            result = gemini.review({'id':'a'*32}, 'review')
            self.assertEqual(result, {'ok':False,'error':'gemini_call_failed'})

    def test_scope_excludes_transport_and_unrelated_jobs(self):
        with patch.object(gemini, 'complete', return_value='reviewed') as call:
            result=gemini.review({'id':'a'*32,'song':{'title':'Current'},'agentLease':'secret','otherJobs':['secret']}, 'review')
            self.assertTrue(result['ok'])
            self.assertNotIn('secret',call.call_args[0][0])

if __name__ == '__main__': unittest.main()
