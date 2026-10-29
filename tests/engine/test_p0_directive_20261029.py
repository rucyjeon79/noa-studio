import copy
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
import noa_p0_register_20261029 as subject


class DirectiveTest(unittest.TestCase):
    def exercise(self, existing=False, bad_hash=False, concurrent=False):
        state = {'revision':24, 'areas':{'P0-01':{'status':'in_progress'}},
                 'instructions':[{'id':'prior','text':'preserve','evidence':['prior-proof']}]}
        if existing:
            # Obtain the exact directive through a first isolated execution.
            state = self.exercise()
        original = copy.deepcopy(state)
        writes = []
        calls = 0

        def request(key, payload):
            nonlocal calls
            if payload['action'] == 'read':
                calls += 1
                result = copy.deepcopy(state)
                if concurrent and calls == 2:
                    result['instructions'][0]['text'] = 'other-work'
                return {'state':result,'summary':{'allAreasComplete':False}}
            r=payload['request']
            if writes:
                self.assertEqual(writes[0],r)
                return {'effect':'work_state_already_recorded'}
            self.assertEqual(r['expectedRevision'],state['revision'])
            self.assertEqual(r['changes'],[])
            writes.append(copy.deepcopy(r))
            state['instructions'].extend(copy.deepcopy(r['appendInstructions']))
            state['instructions'][-1].update(copy.deepcopy(r['taskChanges'][0]))
            state['revision']+=1
            return {'readbackVerified':True}

        class Client:
            def __enter__(self): return self
            def __exit__(self,*args): pass
            def get_channel(self): return self
            def settimeout(self,value): pass
            def open(self,*args): return io.BytesIO(b'x'*64)
        class Transport:
            def close(self): pass
        def fetch(url,**kwargs):
            if 'api.github.com' in url:
                return io.BytesIO(json.dumps({'head_sha':subject.COMMIT,'conclusion':'success','event':'push'}).encode())
            return io.BytesIO(b'changed' if bad_hash else (ROOT/'deploy/noa-app/p0-player.js').read_bytes())
        import os
        cwd=os.getcwd()
        with tempfile.TemporaryDirectory() as tmp:
            try:
                os.chdir(tmp)
                with patch.object(subject,'connect',return_value=Transport()),patch.object(subject.paramiko.SFTPClient,'from_transport',return_value=Client()),patch.object(subject,'request',side_effect=request),patch.object(subject.urllib.request,'urlopen',side_effect=fetch),patch('builtins.print'):
                    subject.main()
            finally: os.chdir(cwd)
        self.assertEqual(state['areas'],original['areas'])
        self.assertEqual(state['instructions'][0],original['instructions'][0])
        self.assertEqual(len(writes),0 if existing else 1)
        self.assertEqual(state['instructions'][-1]['status'],'in_progress')
        return state

    def test_append_preserves_prior_work_and_replay(self): self.exercise()
    def test_existing_directive_is_not_rewritten(self): self.exercise(existing=True)
    def test_changed_player_blocks_registration(self):
        with self.assertRaisesRegex(RuntimeError,'operating_player_changed'): self.exercise(bad_hash=True)
    def test_concurrent_work_is_reported_without_rollback(self):
        with self.assertRaisesRegex(RuntimeError,'concurrent_work_changed'): self.exercise(concurrent=True)

if __name__=='__main__': unittest.main()
