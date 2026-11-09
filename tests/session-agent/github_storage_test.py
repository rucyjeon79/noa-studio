import base64
import copy
import hashlib
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from noa_shorts_github import seal, unseal, transfer, run_github_storage

class Store:
    def __init__(self): self.data={}; self.uploads=0; self.corrupt=False
    def call(self, op, run, **fields):
        key=(run['runId'],run['name'])
        if op=='find': return {'id':self.data.get(key,{}).get('id')}
        if op=='upload':
            self.uploads+=1;self.data[key]={'id':7,'data':Path(fields['path']).read_bytes()};return {'id':7}
        if op=='download':
            data=self.data[key]['data']
            if self.corrupt:data=data[:-1]+bytes([data[-1]^1])
            (Path(fields['path'])/'media.n80').write_bytes(data)
            return {'downloaded':True}

class StorageTests(unittest.TestCase):
    def setUp(self):
        self.key=b'k'*64;self.data=b'private generated media'*30
        sha=hashlib.sha256(self.data).hexdigest()
        self.claim={'id':'a'*32,'key':'image:1:'+sha,'lease':'b'*48,'sourceAudioSha256':'c'*64,
            'artifactName':'n80-media-'+'d'*64,'asset':{'asset':{'sha256':sha,'bytes':len(self.data)}}}
        self.run={'repository':'rucyjeon79/noa-studio','runId':1,'attempt':1}
        self.runs=[];self.saved=[];self.fail=[]
    def dispatch(self, op, **kw):
        if op=='storage_reserve':
            if kw['run'] not in self.runs:self.runs.append(kw['run'])
            return {'artifactRuns':self.runs}
        if op=='storage_read':
            return {'data':base64.b64encode(self.data).decode(),'offset':0,'nextOffset':len(self.data),
                'bytes':len(self.data),'sha256':hashlib.sha256(self.data).hexdigest(),'done':True}
        if op=='storage_complete':
            self.saved.append(kw['receipt']);return {'state':'stored','artifactId':kw['receipt']['artifactId']}
        if op=='storage_fail':self.fail.append(kw['reason']);return {}
        raise AssertionError(op)
    def test_encryption_binds_job_source_and_key(self):
        blob=seal(self.data,self.claim,self.key)
        self.assertNotIn(self.data,blob);self.assertEqual(unseal(blob,self.claim,self.key),self.data)
        for field in ('id','sourceAudioSha256','key'):
            wrong=copy.deepcopy(self.claim);wrong[field]+='changed'
            with self.assertRaises(Exception):unseal(blob,wrong,self.key)
        with self.assertRaises(Exception):unseal(blob,self.claim,b'z'*64)
    def test_upload_readback_and_cross_run_recovery(self):
        store=Store()
        self.assertEqual(transfer(self.dispatch,self.claim,self.key,store,self.run)['state'],'stored')
        self.assertTrue(self.saved[0]['readbackVerified'])
        next_run=dict(self.run,runId=2)
        self.assertEqual(transfer(self.dispatch,self.claim,self.key,store,next_run)['state'],'stored')
        self.assertEqual(store.uploads,1)
    def test_tampered_readback_never_records_completion(self):
        store=Store();store.corrupt=True
        self.assertEqual(transfer(self.dispatch,self.claim,self.key,store,self.run)['state'],'storage_failed')
        self.assertFalse(self.saved);self.assertTrue(self.fail)
    def test_missing_runtime_never_claims_or_spends_retry(self):
        with patch.dict(os.environ,{},clear=True):
            result=run_github_storage(lambda *a,**k:self.fail.append(a),self.key)
        self.assertEqual(result[0]['reason'],'github_runtime_required');self.assertFalse(self.fail)

if __name__=='__main__':unittest.main()
