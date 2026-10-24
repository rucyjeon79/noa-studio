"""Offline proof of fixed-scope consumer runner: no network/SQL/host writes."""
import copy
import io
import hashlib
import hmac
import json
from pathlib import Path
import stat
import sys
from types import SimpleNamespace
import unittest
import urllib.error
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import n80_live_observer as runtime


class Host:
    def __init__(self):
        self.files = {}
        self.writes = []
    def normalize(self, path): return path
    def lstat(self, path):
        if path not in self.files: raise FileNotFoundError(path)
        return SimpleNamespace(st_mode=stat.S_IFREG | 0o600, st_size=len(self.files[path]))
    def open(self, path, mode):
        if mode != 'rb':
            self.writes.append(path)
            raise AssertionError('consumer_runner_cannot_write_host')
        return io.BytesIO(self.files[path])


class Reply(io.BytesIO):
    status = 200
    def __init__(self, body, signature):
        super().__init__(body)
        self.headers = {'Content-Type': 'application/json', 'X-N80-Signature': signature}


class MusicRunnerTest(unittest.TestCase):
    def setUp(self):
        self.key = b'a' * 64
        event_id = 'n80-jukebox-' + 'b' * 64
        self.row = {'jobId': 42, 'eventId': event_id, 'correlationId': event_id, 'effect': 'catalog_observation_only', 'ackEligible': False}
        self.event = {'id': event_id, 'type': 'audio.ready', 'source': 'jukebox', 'subjectId': 'single:test:01',
                      'occurredAt': '2026-10-24T10:00:00+00:00', 'schemaVersion': 1, 'correlationId': event_id}
        self.receipt = {'eventId': event_id, 'eventSha256': runtime.sha(runtime.compact(self.event)), 'correlationId': event_id,
                        'consumer': 'music', 'generation': 1, 'effect': runtime.MUSIC_EFFECT, 'verifiedAt': '2026-10-24T10:00:01+00:00',
                        'proof': {'effect': runtime.MUSIC_EFFECT, 'jobId': 42, 'subjectId': 'single:test:01', 'assetSha256': 'c' * 64,
                                  'assetBytes': 9000, 'detailSha256': 'd' * 64, 'streamPrefixSha256': 'e' * 64,
                                  'catalogReferenceVerified': True, 'publicDetailVerified': True, 'mediaIntegrityVerified': True,
                                  'mutation': False, 'businessDispatch': False}}
        self.host = Host()
        self.host.files[runtime.MUSIC_POLICY] = runtime.compact({'version': 1, 'enabled': True, 'exactConsumer': runtime.MUSIC_EFFECT})
        self.event_path = runtime.MUSIC_BASE + '/events/' + runtime.sha(event_id.encode()) + '.json'
        self.state_path = runtime.MUSIC_BASE + '/leases/' + runtime.sha((event_id + '|music').encode()) + '.json'
        self.host.files[self.event_path] = runtime.compact({'event': self.event, 'plan': {}})
        self.state = {'eventId': event_id, 'consumer': 'music', 'status': 'succeeded', 'generation': 1, 'leaseUntil': None, 'receipt': self.receipt}
        self.host.files[self.state_path] = runtime.compact(self.state)

    def opener(self, results, bad_signature=False, action='verify_availability'):
        def open_request(request, timeout):
            self.assertEqual(request.full_url, runtime.MUSIC_URL)
            self.assertEqual(json.loads(request.data), {'action': action, 'jobId': 42})
            self.assertEqual(request.method, 'POST')
            nonce = request.get_header('X-n80-nonce')
            body = runtime.compact({'ok': True, 'nonce': nonce, 'result': results.pop(0)})
            sig = hmac.new(self.key, ('N80-MUSIC-CONSUME-RESPONSE-1\n' + nonce + '\n' + runtime.sha(body)).encode(), hashlib.sha256).hexdigest()
            return Reply(body, '0' * 64 if bad_signature else sig)
        return SimpleNamespace(open=open_request)

    def result(self, replay=False):
        return {'ok': True, 'status': 'already_acknowledged' if replay else 'acknowledged', 'replayed': replay, 'receipt': copy.deepcopy(self.receipt)}

    def test_signed_ack_replay_is_identical_and_host_has_no_writes(self):
        with patch.object(runtime.urllib.request, 'build_opener', return_value=self.opener([self.result(), self.result(True)])):
            result = runtime.run_music_consumer(self.host, self.key, {'receipts': [self.row]}, runtime.music_consumer_policy(self.host))
        self.assertEqual(result['acknowledged'], 1)
        self.assertTrue(result['receipts'][0]['readbackVerified'])
        self.assertTrue(result['receipts'][0]['replayVerified'])
        self.assertFalse(result['queueMutation'])
        self.assertFalse(result['automaticDispatch'])
        self.assertEqual(result['productionDatabaseWrites'], 0)
        self.assertEqual(self.host.writes, [])

    def test_bad_response_signature_rejected(self):
        with patch.object(runtime.urllib.request, 'build_opener', return_value=self.opener([self.result()], True)):
            with self.assertRaisesRegex(RuntimeError, 'authentication_failed'):
                runtime.request_music_consumer(self.key, self.row)

    def test_missing_policy_is_disabled_without_requests(self):
        del self.host.files[runtime.MUSIC_POLICY]
        with patch.object(runtime.urllib.request, 'build_opener') as network:
            result = runtime.run_music_consumer(self.host, self.key, {'receipts': [self.row]}, runtime.music_consumer_policy(self.host))
        self.assertEqual(result['status'], 'disabled')
        network.assert_not_called()
        self.assertEqual(self.host.writes, [])

    def test_wrong_persisted_event_source_is_rejected(self):
        wrong = dict(self.event, source='client')
        self.host.files[self.event_path] = runtime.compact({'event': wrong})
        with self.assertRaisesRegex(RuntimeError, 'source_mismatch'):
            runtime.music_consumer_readback(self.host, self.result(), self.row)

    def test_unsafe_observation_metadata_is_not_sent(self):
        bad = dict(self.row, ackEligible=True)
        with patch.object(runtime.urllib.request, 'build_opener') as network:
            with self.assertRaisesRegex(RuntimeError, 'untrusted_observed'):
                runtime.request_music_consumer(self.key, bad)
        network.assert_not_called()

    def test_replay_must_not_repeat_execution(self):
        with patch.object(runtime.urllib.request, 'build_opener', return_value=self.opener([self.result(), self.result()])):
            with self.assertRaisesRegex(RuntimeError, 'replay_changed_state'):
                runtime.run_music_consumer(self.host, self.key, {'receipts': [self.row]}, runtime.music_consumer_policy(self.host))

    def test_wrong_scope_and_write_claim_are_rejected(self):
        for mutation in ('effect', 'mutation'):
            result = self.result()
            if mutation == 'effect': result['receipt']['effect'] = 'general_business_completed'
            else: result['receipt']['proof']['mutation'] = True
            with patch.object(runtime.urllib.request, 'build_opener', return_value=self.opener([result])):
                with self.assertRaisesRegex(RuntimeError, 'contract_failed'):
                    runtime.request_music_consumer(self.key, self.row)

    def test_http_error_is_reported_without_raw_body_or_sensitive_values(self):
        body=b'{"error":"music_consumer_unavailable","message":"DO_NOT_LOG_SECRET","diagnostic":{"phase":"db_connect","raw":"DO_NOT_LOG_SECRET"}}'
        error=urllib.error.HTTPError(runtime.MUSIC_URL,503,'private reason',{},io.BytesIO(body))
        opener=SimpleNamespace(open=lambda *args,**kwargs: (_ for _ in ()).throw(error))
        with patch.object(runtime.urllib.request,'build_opener',return_value=opener):
            with self.assertRaises(RuntimeError) as caught:runtime.request_music_consumer(self.key,self.row)
        self.assertIn('503',str(caught.exception));self.assertIn('music_consumer_unavailable',str(caught.exception))
        self.assertNotIn('DO_NOT_LOG_SECRET',str(caught.exception));self.assertNotIn('db_connect',str(caught.exception))

    def test_signed_diagnostic_does_not_require_policy_or_claim_work(self):
        out={'ok':True,'effect':'music_availability_diagnostic_only','jobId':42,'available':False,
             'urlFopenEnabled':False,'reason':'public_url_access_disabled','phase':'public_catalog','httpStatus':0,
             'businessAck':False,'automaticDispatch':False,'queueMutation':False,'databaseWrites':0,'raw':'DO_NOT_LOG_SECRET'}
        with patch.dict(runtime.os.environ,{'N80_MUSIC_CONSUMER_DIAGNOSE_ONLY':'1'}), \
             patch.object(runtime.urllib.request,'build_opener',return_value=self.opener([out],action='diagnose_availability')):
            result=runtime.run_music_consumer(self.host,self.key,{'receipts':[self.row]},{'enabled':False,'reason':'policy_missing'})
        self.assertEqual(result['status'],'diagnostic_only');self.assertEqual(result['acknowledged'],0)
        self.assertEqual(result['diagnostics'][0]['reason'],'public_url_access_disabled')
        self.assertNotIn('DO_NOT_LOG_SECRET',json.dumps(result));self.assertEqual(self.host.writes,[])


if __name__ == '__main__':
    unittest.main()
