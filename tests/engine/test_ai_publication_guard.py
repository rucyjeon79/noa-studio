import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from noa_lab_worker import publication_preflight


class PublicationTest(unittest.TestCase):
    def test_idle_does_not_claim_or_publish(self):
        result = publication_preflight({'jobs': {}})
        self.assertEqual(result['state'], 'idle')
        self.assertEqual(result['jobsModified'], 0)
        self.assertFalse(result['processingEnabled'])

    def test_php_empty_array_is_idle(self):
        self.assertEqual(publication_preflight({'jobs': []})['state'], 'idle')

    def test_pending_and_active_work_are_preserved(self):
        jobs = {'one': {'state': 'queued_render'}, 'two': {'state': 'uploading'}}
        original = repr(jobs)
        result = publication_preflight({'jobs': jobs})
        self.assertEqual(result['state'], 'blocked_publication_policy')
        self.assertEqual((result['queued'], result['active']), (1, 1))
        self.assertEqual(repr(jobs), original)
        self.assertEqual(result['hostTemporaryFiles'], 0)


if __name__ == '__main__':
    unittest.main()
