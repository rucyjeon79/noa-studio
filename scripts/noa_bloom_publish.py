"""Publish only explicitly authorized BLOOM after verified Drive preimage backup."""
import hashlib,json,os,secrets,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
from noa_drive_snapshot import DriveStore
store=DriveStore();store.require() # Fail before hosting changes if backup access is absent.
token=secrets.token_hex(32);name='noa-bridge/bloom-publish-'+secrets.token_hex(8)+'.php'
raw=Path('scripts/noa_bloom_publish.php').read_text().replace('__EXPIRY__',str(int(time.time())+600)).replace('__TOKEN_SHA__',hashlib.sha256(token.encode()).hexdigest()).encode()
t=connect();s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(30);installed=False
def request(body=None):
 req=urllib.request.Request('https://noastudio.ai.kr/'+name,data=None if body is None else json.dumps(body).encode(),headers={'X-NOA-Diagnostic':token,'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=60)as r:result=json.load(r)
 if not result.get('ok'):raise RuntimeError('operation_failed')
 return result
try:
 if s.normalize(ROOT)!=ROOT:raise RuntimeError('wrong_root')
 with s.open(ROOT+'/'+name,'wx')as f:f.write(raw)
 installed=True;s.chmod(ROOT+'/'+name,0o644)
 with s.open(ROOT+'/'+name,'rb')as f:
  if f.read()!=raw:raise RuntimeError('helper_readback_mismatch')
 before=request();backup=Path(os.environ['RUNNER_TEMP'])/'bloom-before.json';backup.write_text(json.dumps(before,ensure_ascii=False));backup.chmod(0o600)
 store.publish('bloom-before-'+os.environ['GITHUB_RUN_ID'],backup)
 print('BLOOM_BACKUP_VERIFIED',json.dumps({'sha256':hashlib.sha256(backup.read_bytes()).hexdigest(),'driveFolder':'1ZeCFabpOvXMB5rNRg8C3m5XR3mPTvKp3'}),flush=True)
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
