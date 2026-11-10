import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('browser_relay', ROOT / 'scripts/n80_browser_relay.py')
relay = importlib.util.module_from_spec(spec)
spec.loader.exec_module(relay)
class BrowserRelay(unittest.TestCase):
    def test_diagnostics_never_emit_remote_exception_text(self):
        for error in [RuntimeError('PRIVATE_COOKIE password account'),ValueError('PRIVATE_EMAIL'),relay.BrowserFailure('PRIVATE_PHASE','PRIVATE_REASON')]:
            result=relay.failure_summary(error,'profile_decode')
            self.assertNotIn('PRIVATE',str(result))
        self.assertEqual(relay.failure_summary(relay.BrowserFailure('profile_restore','operation_failed'),'browser_run'),{'phase':'profile_restore','reason':'operation_failed'})
    def test_profile_authenticated_encryption_and_isolation(self):
        value = {'cookies': [{'name': 'fixture', 'value': 'PRIVATE_COOKIE'}], 'origins': []}
        cipher = relay.encode_profile(b'k'*64, value)
        self.assertNotIn(b'PRIVATE_COOKIE', cipher)
        self.assertEqual(relay.decode_profile(b'k'*64, cipher), value)
        for key, data in [(b'x'*64, cipher), (b'k'*64, cipher[:-1]+bytes([cipher[-1]^1]))]:
            with self.assertRaises(Exception): relay.decode_profile(key, data)
        self.assertNotEqual(cipher, relay.encode_profile(b'k'*64, value))
    def test_no_credentials_in_browser_or_package_manager(self):
        with patch.dict(os.environ, {'NOA_SSH_PASSWORD': 'SECRET', 'GH_TOKEN': 'SECRET', 'NODE_OPTIONS': '--inspect=0.0.0.0', 'NODE_EXTRA_CA_CERTS': '/untrusted'}):
            env = relay.child_env(Path('/private'))
        self.assertFalse({'NOA_SSH_PASSWORD', 'GH_TOKEN', 'NODE_OPTIONS', 'NODE_EXTRA_CA_CERTS'} & env.keys())
    def test_rejects_malformed_or_oversized_profile(self):
        for value in [[], {'cookies': []}, {'cookies': [], 'origins': [], 'large': 'x'*relay.LIMIT}]:
            with self.assertRaises(ValueError): relay.encode_profile(b'k'*64, value)
    def test_connection_observation_never_discloses_credentials_or_frame(self):
        state={'browserControl':{'state':'active','owner':'PRIVATE_OWNER','lease':'PRIVATE_LEASE','input':'PRIVATE_INPUT','frame':'PRIVATE_IMAGE','url':'https://accounts.google.com/?private=1','frameSeq':3,'leaseUntil':200,'expiresAt':300},'browserProfile':{'sha256':'PRIVATE_POINTER'}}
        result=relay.connection_summary(state,100)
        self.assertEqual(result,{'state':'active','hasFrame':True,'framesObserved':True,'inputPending':True,'inputAcknowledged':False,'leaseLive':True,'profileStored':True})
        state['browserControl'].update(input=None,ack=2)
        self.assertTrue(relay.connection_summary(state,100)['inputAcknowledged'])
        self.assertFalse(relay.connection_summary(state,100)['inputPending'])
        self.assertNotIn('PRIVATE',str(result))
        self.assertEqual(relay.connection_summary(state,301)['state'],'expired')
    def test_browser_is_served_before_unrelated_media_setup(self):
        workflow=(ROOT/'.github/workflows/noa-ai-worker.yml').read_text().split('  process:',1)[1]
        transport=workflow.index('name: Prepare the N80 browser transport')
        browser=workflow.index('name: Serve one administrator-requested browser connection through N80')
        media=workflow.index('name: Install local media processor')
        schedule=workflow.index('name: Persist and check the N80 daily Shorts schedule')
        self.assertLess(transport,browser);self.assertLess(browser,media);self.assertLess(browser,schedule)
        self.assertEqual(workflow.count('scripts/n80_auto.py ai.browser_session'),1)
    def test_private_read_rejects_symlinks_and_public_permissions(self):
        class Sftp:
            def lstat(self, p): return Path(p).lstat()
            def normalize(self, p): return str(Path(p).resolve())
            def open(self, p, mode): return open(p, mode)
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder)/'profile'; file.write_bytes(b'encrypted'); file.chmod(0o600)
            self.assertEqual(relay.read_private(Sftp(), str(file)), b'encrypted')
            file.chmod(0o644)
            with self.assertRaises(ValueError): relay.read_private(Sftp(), str(file))
            file.chmod(0o600); link = Path(folder)/'alias'; link.symlink_to(file)
            with self.assertRaises(ValueError): relay.read_private(Sftp(), str(link))
if __name__ == '__main__': unittest.main()
