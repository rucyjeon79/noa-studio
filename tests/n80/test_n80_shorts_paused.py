"""Fail-closed Shorts scheduler contract when N80 owner pauses the web host.

Never calls SFTP, reads secrets, runs AI, writes media, or publishes a video.
"""
import contextlib
import io
import json
from pathlib import Path
import sys
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import noa_daily_shorts


class ShortsPausedTest(unittest.TestCase):
    def run_blocked(self, gate):
        out = io.StringIO()
        with (
            mock.patch.object(noa_daily_shorts, 'remote_gate', side_effect=gate),
            mock.patch.object(noa_daily_shorts, 'worker_key', side_effect=AssertionError('Worker key must not be read')) as key,
            mock.patch.object(noa_daily_shorts, 'signed_tick', side_effect=AssertionError('No provider or host tick')) as tick,
            contextlib.redirect_stdout(out),
        ):
            noa_daily_shorts.main()
        key.assert_not_called()
        tick.assert_not_called()
        line = out.getvalue().strip()
        self.assertTrue(line.startswith('N80_DAILY_SHORTS '))
        record = json.loads(line[len('N80_DAILY_SHORTS '):])
        self.assertEqual(record['state'], 'blocked_by_owner_control')
        self.assertEqual(record['publicationAttempts'], 0)
        self.assertEqual(record['providerCalls'], 0)
        self.assertEqual(record['hostProcessLaunches'], 0)
        return record

    def test_owner_stop_prevents_short_production(self):
        result = self.run_blocked(lambda env: (False, 'owner_stop_or_pause_latched'))
        self.assertEqual(result['reason'], 'owner_stop_or_pause_latched')

    def test_unavailable_sftp_prevents_short_production(self):
        result = self.run_blocked(lambda env: (False, 'sftp_configuration_missing'))
        self.assertEqual(result['reason'], 'sftp_configuration_missing')

    def test_failed_sftp_connection_fails_closed(self):
        def broken(env):
            raise OSError('intentionally offline in unit test')
        result = self.run_blocked(broken)
        self.assertEqual(result['reason'], 'host_control_unreachable')

    def test_bad_host_fingerprint_blocks_short_production(self):
        result = self.run_blocked(lambda env: (False, 'sftp_host_fingerprint_mismatch'))
        self.assertEqual(result['reason'], 'sftp_host_fingerprint_mismatch')


if __name__ == '__main__':
    unittest.main()
