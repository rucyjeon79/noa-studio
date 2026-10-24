import base64
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import threading
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SOURCE=Path(__file__).resolve().parents[1]/'scripts/noa_storage_readonly_inventory.py'
spec=importlib.util.spec_from_file_location('storage_inventory',SOURCE)
runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)
ROOT=runtime.ROOT


def entry(name,mode,size=0):return SimpleNamespace(filename=name,st_mode=mode,st_size=size,st_mtime=123)
D=stat.S_IFDIR;F=stat.S_IFREG
TREE={ROOT:[entry('html',D),entry('noa-jukebox-private',D),entry('noa-deploy-backups',D),entry('root.txt',F,3),
            entry('do-not-follow',stat.S_IFLNK),entry('socket',stat.S_IFSOCK)],
 ROOT+'/html':[entry('index.php',F,10),entry('cache.tmp',F,7),entry('assets',D)],
 ROOT+'/html/assets':[entry('a.mp3',F,20),entry('test-tone.mp3',F,30)],
 ROOT+'/noa-jukebox-private':[entry('media',D),entry('incoming',D)],
 ROOT+'/noa-jukebox-private/media':[entry('final.mp3',F,40),entry('cover.webp',F,50)],
 ROOT+'/noa-jukebox-private/incoming':[entry('empty',F,0)],
 ROOT+'/noa-deploy-backups':[entry('run-1',D)],
 ROOT+'/noa-deploy-backups/run-1':[entry('old.php',F,5)]}


class Tracker:
    def __init__(self):self.lock=threading.Lock();self.active=0;self.maximum=0;self.listed=[]


class Client:
    def __init__(self,tracker,fail=None,canonical=None):
        self.tracker=tracker;self.fail=fail;self.canonical=canonical or {};self.busy=threading.Lock()
    def lstat(self,path):
        if path!=ROOT:raise AssertionError('only fixed root lstat needed')
        return SimpleNamespace(st_mode=D)
    def normalize(self,path):return self.canonical.get(path,path)
    def listdir_iter(self,path,read_aheads):
        if not self.busy.acquire(blocking=False):raise AssertionError('concurrent use of one SFTP client')
        try:
            self.tracker.lock.acquire();self.tracker.active+=1
            self.tracker.maximum=max(self.tracker.maximum,self.tracker.active);self.tracker.listed.append(path);self.tracker.lock.release()
            time.sleep(.01)
            if path==self.fail:raise OSError('not exposed')
            if path not in TREE:raise AssertionError('outside tree traversal')
            if read_aheads!=16:raise AssertionError('bounded read ahead')
            yield from TREE[path]
        finally:
            with self.tracker.lock:self.tracker.active-=1
            self.busy.release()
    def get_channel(self):return SimpleNamespace(settimeout=lambda _:None)
    def close(self):pass
    def open(self,*args):raise AssertionError('metadata inventory must never read or write file contents')
    def get(self,*args):raise AssertionError('no downloads')


class InventoryTest(unittest.TestCase):
    def test_parallel_exact_totals_candidates_and_exclusions(self):
        tracker=Tracker();clients=[Client(tracker) for _ in range(2)]
        report=runtime.scan_metadata(clients)
        self.assertTrue(report['scanComplete']);self.assertEqual(report['files'],9)
        totals={r['folder']:(r['bytes'],r['files']) for r in report['folders_by_bytes']}
        self.assertEqual(totals,{'html':(67,4),'noa-jukebox-private':(90,3),'noa-deploy-backups':(5,1),'root.txt':(3,1)})
        self.assertEqual(sum(v[0] for v in totals.values()),165)
        self.assertEqual(report['candidates'],{'deploy_backup':[5,1],'staged':[7,1],'synthetic_candidate':[30,1]})
        self.assertEqual(report['candidate_files'][0]['path'],'html/assets/test-tone.mp3')
        self.assertEqual(report['symlinksSkipped'],1);self.assertEqual(report['nonregularSkipped'],1)
        self.assertEqual(report['directoriesListed'],8);self.assertEqual(len(tracker.listed),len(set(tracker.listed)))
        self.assertGreaterEqual(tracker.maximum,2);self.assertLessEqual(tracker.maximum,2)
        self.assertEqual(report['channelsUsed'],2);self.assertIn('startedAt',report);self.assertIn('finishedAt',report)

    def test_one_and_four_channels_produce_identical_legacy_fields(self):
        fields=['files','candidate_files','subfolders_by_bytes','folders_by_bytes','candidates','unreadable_folders']
        one=runtime.scan_metadata([Client(Tracker())])
        tracker=Tracker();four=runtime.scan_metadata([Client(tracker) for _ in range(4)])
        self.assertEqual({k:one[k]for k in fields},{k:four[k]for k in fields})
        self.assertLessEqual(tracker.maximum,4)

    def test_directory_error_marks_partial_and_preserves_known_counts(self):
        tracker=Tracker();report=runtime.scan_metadata([Client(tracker,fail=ROOT+'/html')])
        self.assertFalse(report['scanComplete']);self.assertEqual(report['unreadable_folders'],1)
        self.assertEqual(report['files'],5);self.assertEqual(sum(r['bytes']for r in report['folders_by_bytes']),98)
        self.assertNotIn('not exposed',json.dumps(report))

    def test_noncanonical_subdirectory_is_never_listed(self):
        tracker=Tracker();report=runtime.scan_metadata([Client(tracker,canonical={ROOT+'/html':'/outside'})])
        self.assertFalse(report['scanComplete']);self.assertNotIn(ROOT+'/html',tracker.listed)
        self.assertNotIn('/outside',tracker.listed)

    def test_noncanonical_root_fails_closed_without_traversal(self):
        tracker=Tracker();report=runtime.scan_metadata([Client(tracker,canonical={ROOT:'/outside'})])
        self.assertFalse(report['scanComplete']);self.assertEqual(tracker.listed,[])

    def test_deadline_and_directory_cap_are_explicitly_incomplete(self):
        report=runtime.scan_metadata([Client(Tracker())],budget_seconds=0)
        self.assertFalse(report['scanComplete']);self.assertEqual(report['files'],0)
        with patch.object(runtime,'MAX_DIRECTORIES',2):report=runtime.scan_metadata([Client(Tracker())])
        self.assertFalse(report['scanComplete']);self.assertTrue(any(e['code']=='directory_limit'for e in report['errors']))

    def test_channel_count_is_bounded_and_malformed_metadata_is_incomplete(self):
        tracker=Tracker();report=runtime.scan_metadata([Client(tracker)for _ in range(5)])
        self.assertFalse(report['scanComplete']);self.assertEqual(tracker.listed,[])
        bad=list(TREE[ROOT])+[entry('../escape',F,1),entry('unknown-mode',True,1),entry('bad-size',F,-1)]
        with patch.dict(TREE,{ROOT:bad}):report=runtime.scan_metadata([Client(Tracker())])
        self.assertFalse(report['scanComplete']);self.assertEqual(report['files'],9)
        self.assertEqual({e['code']for e in report['errors']},{'unsafe_entry_name','missing_entry_type','invalid_entry_size'})

    def fake_paramiko(self,tracker,refuse_after=None):
        calls={'transports':0,'auth':0,'channels':0}
        class Transport:
            def __init__(self,address):calls['transports']+=1
            def get_security_options(self):return SimpleNamespace(key_types=None)
            def start_client(self,timeout):pass
            def get_remote_server_key(self):return SimpleNamespace(asbytes=lambda:b'fake-host-key')
            def auth_password(self,user,password):calls['auth']+=1
            def is_authenticated(self):return True
            def set_keepalive(self,seconds):pass
            def close(self):pass
        def channel(transport):
            calls['channels']+=1
            if refuse_after is not None and calls['channels']>refuse_after:raise OSError('not exposed server detail')
            return Client(tracker)
        return SimpleNamespace(Transport=Transport,SFTPClient=SimpleNamespace(from_transport=channel)),calls

    def run_main(self,refuse_after=None,channels='2'):
        tracker=Tracker();module,calls=self.fake_paramiko(tracker,refuse_after)
        fingerprint='SHA256:'+base64.b64encode(hashlib.sha256(b'fake-host-key').digest()).decode().rstrip('=')
        env={'NOA_SSH_HOST':'fake-host','NOA_SSH_USER':'fake-user','NOA_SSH_PASSWORD':'not-a-real-secret',
             'NOA_SSH_HOST_FINGERPRINT':fingerprint,'NOA_STORAGE_SFTP_CHANNELS':channels}
        original=os.getcwd()
        try:
            with tempfile.TemporaryDirectory() as directory,patch.dict(os.environ,env),patch.dict(sys.modules,{'paramiko':module}),contextlib.redirect_stdout(io.StringIO()):
                os.chdir(directory)
                exit_code=0
                try:runtime.main()
                except SystemExit as e:exit_code=e.code
                report=json.loads(Path('storage-audit/inventory.json').read_text())
        finally:os.chdir(original)
        return report,calls,exit_code

    def test_one_transport_one_auth_and_two_independent_channels(self):
        report,calls,exit_code=self.run_main()
        self.assertEqual(calls,{'transports':1,'auth':1,'channels':2});self.assertEqual(exit_code,0)
        self.assertTrue(report['scanComplete']);self.assertEqual(report['files'],9)

    def test_server_channel_cap_falls_back_to_one_but_reports_error(self):
        report,calls,exit_code=self.run_main(refuse_after=1,channels='4')
        self.assertEqual(calls,{'transports':1,'auth':1,'channels':2});self.assertEqual(exit_code,1)
        self.assertEqual(report['channelsUsed'],1);self.assertTrue(report['channelFallbackUsed'])
        self.assertFalse(report['scanComplete']);self.assertEqual(report['files'],9)


if __name__=='__main__':unittest.main()
