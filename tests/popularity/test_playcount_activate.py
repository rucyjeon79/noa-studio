"""Policy idempotency tests use no SSH, HTTP or production data."""
import copy
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
import noa_playcount_activate as activation


class ActivationTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.state=Path(self.tmp.name)/'state.json'
        self.patch=patch.object(activation,'STATE',self.state);self.patch.start();self.addCleanup(self.patch.stop)
        self.baseline={'playbackIntegrationEnabled':False,'minimumSeconds':30,'dedupeEnabled':True}
        self.receipt={'readbackVerified':True,'backupSha256':'34fcff78ce9aee66461bd89fe9bcb63ddf75365a26ba3f6169ec897b58cdb73b',
                      'revision':1,'policySha256':activation.digest(self.baseline),'driveId':'verified-drive-id'}
        self.sources={p:'a'*64 for p in activation.SOURCES}
        self.policy=self.baseline|{'playbackIntegrationEnabled':True}
        self.before={'policy':self.policy,'policySha256':activation.digest(self.policy),'revision':2,'sources':self.sources,'changed':False}

    def run_activate(self,values,rollback=False):
        with patch.object(activation,'call',side_effect=values)as remote,contextlib.redirect_stdout(io.StringIO()):
            result=activation.activate(b'not-a-real-key',self.receipt,self.sources,rollback)
        return result,remote

    def test_already_enabled_only_inspects_and_returns_changed_false(self):
        result,remote=self.run_activate([self.before,copy.deepcopy(self.before)])
        self.assertFalse(result['changed']);self.assertTrue(result['readbackVerified'])
        self.assertEqual([c.args[1]['action']for c in remote.call_args_list],['inspect','inspect'])
        self.assertEqual(json.loads(self.state.read_text()),result)

    def test_unchanged_rollback_does_not_contact_server(self):
        self.run_activate([self.before,copy.deepcopy(self.before)])
        result,remote=self.run_activate([],rollback=True)
        remote.assert_not_called();self.assertTrue(result['rollbackSkipped']);self.assertFalse(result['changed'])

    def test_any_other_policy_or_source_change_blocks_noop(self):
        for mutation in ('policy','sources','revision'):
            before=copy.deepcopy(self.before)
            if mutation=='policy':before['policy']['minimumSeconds']=10;before['policySha256']=activation.digest(before['policy'])
            elif mutation=='sources':before['sources'][activation.SOURCES[0]]='b'*64
            else:before['revision']=1
            with patch.object(activation,'call',return_value=before)as remote:
                with self.assertRaises(RuntimeError):activation.activate(b'key',self.receipt,self.sources)
            self.assertEqual(remote.call_count,1)
            self.assertFalse(self.state.exists())

    def test_unverified_backup_is_rejected_before_inspect(self):
        for key,value in [('readbackVerified',False),('backupSha256','0'*64),('revision',True)]:
            receipt=self.receipt|{key:value}
            with patch.object(activation,'call')as remote:
                with self.assertRaisesRegex(RuntimeError,'policy_recovery_not_verified'):
                    activation.activate(b'key',receipt,self.sources)
            remote.assert_not_called()

    def test_concurrent_policy_change_between_inspections_is_preserved(self):
        after=copy.deepcopy(self.before);after['revision']=3
        with patch.object(activation,'call',side_effect=[self.before,after])as remote:
            with self.assertRaisesRegex(RuntimeError,'readback_failed'):
                activation.activate(b'key',self.receipt,self.sources)
        self.assertEqual([c.args[1]['action']for c in remote.call_args_list],['inspect','inspect'])
        self.assertFalse(self.state.exists())

    def test_actual_enable_still_uses_cas_and_keeps_rollback_ownership(self):
        baseline={'policy':self.baseline,'policySha256':activation.digest(self.baseline),'revision':1,'sources':self.sources,'changed':False}
        result,remote=self.run_activate([baseline,{'changed':True},self.before])
        self.assertTrue(result['changed']);self.assertEqual(remote.call_args_list[1].args[1]['expectedRevision'],1)
        original=self.state.read_bytes()
        result,_=self.run_activate([self.before,copy.deepcopy(self.before)])
        self.assertFalse(result['changed']);self.assertTrue(result['rollbackOwnedByEarlierAttempt'])
        self.assertEqual(self.state.read_bytes(),original)


if __name__=='__main__':unittest.main()
