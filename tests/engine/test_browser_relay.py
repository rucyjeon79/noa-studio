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
