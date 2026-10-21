import io,json,sys,unittest,urllib.error
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
import noa_jukebox_recovery as recovery
import noa_jukebox_upload_worker as upload

class Response(io.BytesIO):
    status=200
    headers={'Content-Type':'application/json'}
    def __enter__(self):return self
    def __exit__(self,*args):self.close()

class RecoveryTests(unittest.TestCase):
    def test_503_retries_have_fresh_nonce_and_no_sensitive_body(self):
        requests=[];sleeps=[]
        def request(req,**kwargs):
            requests.append(req)
            if len(requests)<3:raise urllib.error.HTTPError(req.full_url,503,'private response body',{'Retry-After':'4'},io.BytesIO(b'password=secret'))
            return Response(b'{"ok":true,"result":{"ready":true}}')
        with patch.object(recovery.urllib.request,'urlopen',side_effect=request):
            self.assertTrue(recovery.signed_service('k'*64,sleeps.append)('upload_commit',{'id':'a'*32})['ready'])
        self.assertEqual(sleeps,[4,4]);self.assertEqual(len({r.get_header('X-noa-nonce') for r in requests}),3)
        self.assertEqual(len({r.data for r in requests}),1)

    def test_terminal_status_only_permits_stale_worker_recovery(self):
        events=[]
        def call(action,body=None):
            events.append((action,body))
            if action=='runtime_health':return {'active_runs':[{'worker_run_id':'123'},{'worker_run_id':'456'}]}
            if action=='maintenance':return {'checked':2,'issues':[]}
            if action=='audit':return {'assets':1,'covers':1,'audio':1,'audio_bytes':10,'invalid':[]}
            if action=='integrity_snapshot':return {'documents':1}
            return {'recorded':True}
        result=recovery.watchdog(call,lambda run:'running' if run=='123' else 'terminal')
        self.assertEqual(result['processes_terminated'],0)
        self.assertEqual(events[1:3],[('worker_observation',{'run_id':'123','state':'running'}),('worker_observation',{'run_id':'456','state':'terminal'})])

    def test_runtime_owner_wraps_claims_and_releases_without_canceling(self):
        events=[]
        def call(action,body=None):
            events.append((action,body))
            if action=='worker_start':return {'acquired':True,'owner':body['owner']}
            if action=='upload_claim':return {'uploads':[]}
            return {}
        self.assertEqual(upload.process_uploads(None,call,None,worker_identity={'run_id':'123','source_commit':'a'*40}),[])
        self.assertEqual([a for a,b in events],['worker_start','upload_claim','worker_finish'])
        self.assertEqual(events[0][1]['owner'],events[1][1]['worker_owner'])

    def test_lost_commit_ack_does_not_fail_confirmed_mp3(self):
        # Drive the real worker's exception handler before opening any source.
        job={'id':'a'*32,'job_id':7,'key':'jukebox:qa:ack','lease':'b'*32,'extension':'wav'}
        events=[];claims=0
        def call(action,body=None):
            nonlocal claims
            events.append(action)
            if action=='upload_claim':
                claims+=1;return {'uploads':[job] if claims==1 else []}
            if action=='upload_reconcile':return {'status':'ready','final_verified':True,'source_matches_final':True}
            if action=='upload_cleanup':return {'input_removed':True}
            raise AssertionError('confirmed output must not invoke '+action)
        class SourceUnavailable:
            def lstat(self,path):raise TimeoutError('no response after commit')
        result=upload.process_uploads(SourceUnavailable(),call,None)
        self.assertTrue(result[0]['ready']);self.assertTrue(result[0]['response_recovered']);self.assertNotIn('upload_fail',events)

if __name__=='__main__':unittest.main()

class IdleRecoveryTests(unittest.TestCase):
    def test_worker_waits_for_later_upload_without_a_browser(self):
        clock=[0];claims=[0]
        def call(action,body=None):
            if action=='upload_claim':claims[0]+=1;return {'uploads':[]}
            return {}
        def advance(seconds):clock[0]+=seconds
        with patch.object(upload.time,'monotonic',side_effect=lambda:clock[0]),patch.object(upload.time,'sleep',side_effect=advance):
            self.assertEqual(upload._drain_uploads(None,call,None,idle_seconds=45),[])
        self.assertGreaterEqual(claims[0],3);self.assertEqual(clock[0],45)
