import base64
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'integrations/private-worker'))
from gemini_connect import connect, SECRET, REPOSITORY

class ConnectTests(unittest.TestCase):
    def setUp(self):
        self.calls=[]
        self.recipient={'key_id':'12345','key':base64.b64encode(b'p'*32).decode()}
    def call(self, method, suffix, data=None):
        self.calls.append((method,suffix,data))
        return self.recipient if method=='GET' else {}
    def request(self):
        return {'mode':'connect','key_id':'12345','encrypted_value':base64.b64encode(b'c'*150).decode()}
    def test_prepare_reads_only_public_recipient(self):
        r=connect({'mode':'prepare'},self.call)
        self.assertEqual(r['repository'],REPOSITORY)
        self.assertEqual(self.calls,[('GET','public-key',None)])
    def test_only_exact_secret_and_sealed_body_are_written(self):
        r=connect(self.request(),self.call)
        self.assertEqual(self.calls[1][0:2],('PUT',SECRET))
        self.assertEqual(set(self.calls[1][2]),{'key_id','encrypted_value'})
        self.assertFalse(r['connected'])
    def test_plaintext_and_expanded_scope_rejected_before_network(self):
        for values in ({'encrypted_value':'{"refresh_token":"not-for-git"}'},{'secret':'OTHER'},{'key_id':'wrong'}):
            with self.subTest(values=values):
                self.calls=[]
                with self.assertRaises((ValueError,TypeError)):
                    connect(self.request()|values,self.call)
                self.assertFalse(self.calls)
    def test_rotated_recipient_does_not_write_wrong_key(self):
        with self.assertRaisesRegex(ValueError,'recipient_key_changed'):
            connect(self.request()|{'key_id':'777'},self.call)
        self.assertEqual(len(self.calls),1)

if __name__=='__main__':unittest.main()
