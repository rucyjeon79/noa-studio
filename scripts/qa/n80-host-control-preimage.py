#!/usr/bin/env python3
"""Encrypted preimage of the N80 host scheduler control file.
Read-only on remote SFTP; emits no raw control content in logs/artifacts.
Drive upload must be verified BEFORE any control stop operation.
"""
import base64,hashlib,json,os,secrets,stat,time
from pathlib import Path
import paramiko
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT='/hosting/noastudio/noa-hub'
PIN='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU'
OUT=Path('n80-stop-preimage')
host=os.environ['NOA_SSH_HOST'];user=os.environ['NOA_SSH_USER'];password=os.environ['NOA_SSH_PASSWORD']
t=paramiko.Transport((host,2022))
try:
 t.get_security_options().key_types=('ssh-ed25519',)
 t.start_client(timeout=18)
 fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
 if fp!=PIN:raise RuntimeError('host_fingerprint_mismatch')
 t.auth_password(user,password)
 s=paramiko.SFTPClient.from_transport(t)
 s.get_channel().settimeout(30)
 if s.normalize(ROOT)!=ROOT:raise RuntimeError('runtime_directory_mismatch')
 file=ROOT+'/control.json'
 st=s.lstat(file)
 if not stat.S_ISREG(st.st_mode) or st.st_size>32768:raise RuntimeError('unsafe_control_file')
 with s.open(file,'rb') as handle:b=handle.read(32769)
 if len(b)>32768 or len(b)!=st.st_size:raise RuntimeError('control_size_changed')
 document=json.loads(b)
 if not isinstance(document,dict):raise RuntimeError('bad_control_format')
 if sorted(document.keys())!=['activeOperations','migrations','paused','revision','stop']:
  raise RuntimeError('unexpected_control_schema')
 if not isinstance(document['revision'],int) or type(document['paused']) is not bool or type(document['stop']) is not bool:
  raise RuntimeError('control_types_changed')
 if not isinstance(document['activeOperations'],list) or not isinstance(document['migrations'],dict):
  raise RuntimeError('control_nested_type_changed')
 if len(document['activeOperations'])>50:raise RuntimeError('too_many_operations')
 digest=hashlib.sha256(b).hexdigest()
 salt=secrets.token_bytes(16);nonce=secrets.token_bytes(12)
 key=hashlib.pbkdf2_hmac('sha256',password.encode('utf8'),salt,300000,dklen=32)
 ciphertext=AESGCM(key).encrypt(nonce,b,digest.encode())
 OUT.mkdir(parents=True,exist_ok=True)
 blob={'version':1,'encryption':'AES-256-GCM/PBKDF2-SHA256/300000',
  'keySource':'NOA_SSH_PASSWORD (GitHub Actions secret, NOT included)',
  'salt':base64.b64encode(salt).decode(),'nonce':base64.b64encode(nonce).decode(),
  'ciphertext':base64.b64encode(ciphertext).decode(),'sha256':digest,'bytes':len(b),
  'sourceRevisionGuard':document['revision'],
  'sourcePath':ROOT+'/control.json','capturedEpoch':int(time.time())}
 (OUT/'encrypted-control-preimage.json').write_text(json.dumps(blob,indent=2),encoding='utf8')
 (OUT/'README.txt').write_text('N80 original host scheduler control.json encrypted backup.\n'
  'Upload this archive to Google Drive before stopping the runner.\n'
  'Restore only after validating SHA256 and using the existing protected deploy workflow.\n',encoding='utf8')
 print('N80_CONTROL_PREIMAGE='+json.dumps({
  'ready':True,'originalSha256':digest,'revision':document['revision'],
  'paused':document['paused'],'stop':document['stop'],'bytes':len(b),
  'encryption':'AES-256-GCM','hostWrites':0,'plaintextInArtifact':False
 },separators=(',',':')))
finally:t.close()
