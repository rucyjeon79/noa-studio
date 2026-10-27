"""Actual VAPID signing and RFC8291 encryption, with an in-memory HTTP transport."""
import base64,json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
import http_ece,requests
from cryptography.hazmat.primitives import serialization,hashes
from cryptography.hazmat.primitives.asymmetric import ec,utils
import noa_push_dispatch as dispatch

def b64(raw):return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()
def un64(raw):return base64.urlsafe_b64decode(raw+'='*(-len(raw)%4))

class PushTransport(unittest.TestCase):
 def test_real_encryption_vapid_and_receipt_payload(self):
  application=ec.generate_private_key(ec.SECP256R1());receiver=ec.generate_private_key(ec.SECP256R1());auth=b'a'*16
  pem=application.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption())
  public=application.public_key().public_bytes(serialization.Encoding.X962,serialization.PublicFormat.UncompressedPoint)
  cfg={'version':1,'workerToken':'f'*64,'privateKey':pem.decode(),'publicKey':b64(public)}
  self.assertEqual(dispatch.validate_config(cfg),cfg)
  job={'subscription':{'endpoint':'https://fcm.googleapis.com/fcm/send/isolated-test','keys':{'p256dh':b64(receiver.public_key().public_bytes(serialization.Encoding.X962,serialization.PublicFormat.UncompressedPoint)),'auth':b64(auth)}},'payload':{'id':42,'body':'내 게시물에 새 댓글이 달렸어요.','receipt':'a'*64}}
  captured=[]
  def post(url,**kw):
   captured.append((url,kw));response=requests.Response();response.status_code=201;response._content=b'';return response
  with tempfile.TemporaryDirectory() as temp:
   path=Path(temp)/'vapid.pem';path.write_bytes(pem)
   with patch('requests.post',side_effect=post):self.assertEqual(dispatch.deliver(job,str(path)),201)
  url,kw=captured[0];self.assertFalse(kw['allow_redirects']);self.assertEqual(kw['timeout'],8)
  self.assertNotIn(job['payload']['body'].encode(),kw['data'])
  self.assertEqual(json.loads(http_ece.decrypt(kw['data'],private_key=receiver,auth_secret=auth,version='aes128gcm')),job['payload'])
  header={k.lower():v for k,v in kw['headers'].items()}['authorization'];jwt=header.split('t=',1)[1].split(',',1)[0];parts=jwt.split('.');claims=json.loads(un64(parts[1]));self.assertEqual(claims['aud'],'https://fcm.googleapis.com');self.assertEqual(claims['sub'],dispatch.ORIGIN)
  sig=un64(parts[2]);der=utils.encode_dss_signature(int.from_bytes(sig[:32],'big'),int.from_bytes(sig[32:],'big'));application.public_key().verify(der,(parts[0]+'.'+parts[1]).encode(),ec.ECDSA(hashes.SHA256()))
 def test_expired_status_and_endpoint_boundary(self):
  for url in ['https://127.0.0.1/push','https://evil.example/push','https://fcm.googleapis.com.evil.example/push','https://fcm.googleapis.com@evil.example/push','http://fcm.googleapis.com/push','https://fcm.googleapis.com:444/push']:
   self.assertFalse(dispatch.safe_endpoint(url))
  for url in ['https://fcm.googleapis.com/fcm/send/id','https://updates.push.services.mozilla.com/wpush/v2/id','https://web.push.apple.com/id']:
   self.assertTrue(dispatch.safe_endpoint(url))
  self.assertEqual(dispatch.deliver({'subscription':{'endpoint':'http://127.0.0.1'},'payload':{}},'unused'),410)
  response=requests.Response();response.status_code=410
  with patch.object(dispatch,'webpush',side_effect=dispatch.WebPushException('private response',response=response)):
   self.assertEqual(dispatch.deliver({'subscription':{'endpoint':'https://fcm.googleapis.com/id'},'payload':{}},'unused'),410)
if __name__=='__main__':unittest.main()
