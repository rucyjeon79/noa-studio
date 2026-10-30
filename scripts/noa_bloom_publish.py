"""Publish only explicitly authorized BLOOM after verified Drive preimage backup."""
import hashlib,json,os,secrets,time,urllib.request,urllib.parse,base64
from cryptography.hazmat.primitives import serialization,hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
from noa_drive_snapshot import DriveStore
store=DriveStore()
HAS_DRIVE=bool(os.environ.get("NOA_DRIVE_RCLONE_CONFIG_B64"))
if HAS_DRIVE:store.require()
RECEIPT={"digest":"229fe8cbb6d3ff6c05da6083bc821dbd106971811b9605b39a9425923d631dd8","sha256":"6f93fb25fc38fcbe78d369bc37d9f5df3029d9eb031775a0e5182a308efea320","rows":2,"driveFileId":"1I5USF_oMZYf9za3haR-aoAkAq8a8zmxh"}
PUBLIC_KEY=b'-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1kceXoZhE1fSl11wYQ2m\nxxp5uZh5poTUIh9eMJGoSrE6Lw5kOxkoCG9J1DvkaEzbS2Q3MQwGV8xOGZSws/iB\nR0hzyTNzcmz5ZMwwDiW514iOOA3cHikg/S9b31SEuUrcV7etuFsTgFxEBwZiG3Mo\nomkkcr+r9fGRU4GXdOuzoAK/OqRsylrYNzSDQx0fKMn1O4VaFNde5fXgo1uif+zV\nXOGTjeZD9SFwMLxSBDX2uCNEiR9eheyh88Wd4AsumKLrLknxQzhnUee3zcJ5km3Q\n6bXutBNjO6HwLT38fSKOFTRH5+AVYmdKRnr4OIbPM/h8ZtNxiich8r5I91Mh+l9N\nNQIDAQAB\n-----END PUBLIC KEY-----\n'
token=secrets.token_hex(32);name='noa-bridge/bloom-publish-'+secrets.token_hex(8)+'.php'
raw=Path('scripts/noa_bloom_publish.php').read_text().replace('__EXPIRY__',str(int(time.time())+600)).replace('__TOKEN_SHA__',hashlib.sha256(token.encode()).hexdigest()).encode()
t=connect();s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(30);installed=False
def request(body=None):
 req=urllib.request.Request('https://noastudio.ai.kr/'+name,data=None if body is None else urllib.parse.urlencode(body).encode(),headers={'X-NOA-Diagnostic':token,'Content-Type':'application/x-www-form-urlencoded','User-Agent':'NOA-authorized-publisher/1','Origin':'https://noastudio.ai.kr','Referer':'https://noastudio.ai.kr/'})
 try:
  with urllib.request.urlopen(req,timeout=60)as r:result=json.load(r)
 except urllib.error.HTTPError as e:
  print('BLOOM_GUARD_FAILURE',e.read().decode()[:500],flush=True);raise
 if not result.get('ok'):raise RuntimeError('operation_failed: '+json.dumps(result))
 return result
try:
 if s.normalize(ROOT)!=ROOT:raise RuntimeError('wrong_root')
 with s.open(ROOT+'/'+name,'wx')as f:f.write(raw)
 installed=True;s.chmod(ROOT+'/'+name,0o644)
 with s.open(ROOT+'/'+name,'rb')as f:
  if f.read()!=raw:raise RuntimeError('helper_readback_mismatch')
 before=request();backup=Path(os.environ['RUNNER_TEMP'])/'bloom-before.json';backup.write_text(json.dumps(before,ensure_ascii=False));backup.chmod(0o600)
 if HAS_DRIVE:
  store.publish('bloom-before-'+os.environ['GITHUB_RUN_ID'],backup)
 elif RECEIPT is None:
  key=secrets.token_bytes(32);nonce=secrets.token_bytes(12)
  wrapped=serialization.load_pem_public_key(PUBLIC_KEY).encrypt(key,padding.OAEP(mgf=padding.MGF1(hashes.SHA256()),algorithm=hashes.SHA256(),label=None))
  cipher=AESGCM(key).encrypt(nonce,backup.read_bytes(),None)
  print('BLOOM_ENCRYPTED_BACKUP '+base64.b64encode(wrapped+nonce+cipher).decode(),flush=True)
  print('BLOOM_AWAITING_DRIVE_RECEIPT',flush=True)
  raise SystemExit(0)
 elif before['digest']!=RECEIPT['digest']:
  raise RuntimeError('verified_backup_no_longer_matches')
 print('BLOOM_BACKUP_VERIFIED',json.dumps({'sha256':hashlib.sha256(backup.read_bytes()).hexdigest(),'driveFolder':('1ZeCFabpOvXMB5rNRg8C3m5XR3mPTvKp3' if HAS_DRIVE else '1N4ddmFbGpMEMGLB3zg4XJYBzLk3mHds2')}),flush=True)
 result=request({'expectedDigest':before['digest']})
 after=request();old={r['doc_key']:r for r in before['rows']};new={r['doc_key']:r for r in after['rows']}
 changed=[k for k in old if old[k]!=new[k]]
 if len(changed)!=1 or not changed[0].startswith('catalog:a785dbc3'):raise RuntimeError('unexpected_changes')
 a=json.loads(old[changed[0]]['payload']);b=json.loads(new[changed[0]]['payload']);b['visibility']='private'
 if a!=b:raise RuntimeError('other_fields_changed')
 print('BLOOM_PUBLICATION_VERIFIED',json.dumps(result),flush=True)
finally:
 try:
  if installed:
   with s.open(ROOT+'/'+name,'rb')as f:current=f.read()
   if current!=raw:raise RuntimeError('helper_changed_preserved')
   s.remove(ROOT+'/'+name);print('BLOOM_HELPER_REMOVED',flush=True)
 finally:s.close();t.close()
