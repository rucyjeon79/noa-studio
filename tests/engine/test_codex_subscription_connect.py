import importlib.util
from pathlib import Path
import sys
import unittest
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.exceptions import InvalidTag
import base64,json

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts'))
import n80_codex_subscription_connect as m

class ConnectionTests(unittest.TestCase):
    def test_challenge_requires_official_origin(self):
        self.assertIsNone(m.challenge_from_output('https://example.com/codex/device\n   ABCD-EFGH\n'))
        self.assertIsNone(m.challenge_from_output('https://auth.openai.com/codex/device\n'))
    def test_ansi_challenge_is_encrypted_for_requester(self):
        q=m.challenge_from_output('https://auth.openai.com/codex/device\n   \x1b[34mABCD-EFGH\x1b[0m\n')
        self.assertEqual(q['code'],'ABCD-EFGH')
        key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
        public=key.public_key().public_bytes(serialization.Encoding.PEM,serialization.PublicFormat.SubjectPublicKeyInfo)
        cipher=m.encrypt_challenge(q,public)
        self.assertNotIn(q['code'],cipher)
        raw=key.decrypt(base64.b64decode(cipher),padding.OAEP(mgf=padding.MGF1(hashes.SHA256()),algorithm=hashes.SHA256(),label=None))
        self.assertEqual(json.loads(raw),q)
    def test_vault_detects_corruption_and_wrong_key(self):
        key=b'A'*32;raw=b'{"tokens":{"access_token":"fixture"}}';cipher=m.seal(raw,key)
        self.assertNotIn(b'fixture',cipher);self.assertEqual(m.unseal(cipher,key),raw)
        with self.assertRaises(InvalidTag):m.unseal(cipher,b'B'*32)
        with self.assertRaises(InvalidTag):m.unseal(cipher[:-1]+bytes([cipher[-1]^1]),key)
    def test_unresolved_request_never_restarts(self):
        q={'id':'a'*32}
        for state in ('connecting','failed','unconfirmed'):
            with self.assertRaisesRegex(RuntimeError,'prior_connection_requires_review'):
                m.allowed_new_request({'state':state,'requestId':q['id']},q,'100')
        self.assertTrue(m.allowed_new_request(None,q,'100'))
        self.assertFalse(m.allowed_new_request({'state':'authenticated'},q,'100'))
    def test_model_and_deployment_credentials_not_inherited(self):
        from unittest.mock import patch
        with patch.dict(m.os.environ,{'OPENAI_API_KEY':'secret','NOA_SSH_PASSWORD':'secret','CODEX_AUTH_JSON':'secret','HOME':'/actual-home'},clear=True):
            self.assertEqual(m.clean_env(),{'HOME':'/actual-home'})

if __name__=='__main__':unittest.main()
