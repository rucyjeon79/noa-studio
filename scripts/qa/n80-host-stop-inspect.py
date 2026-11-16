#!/usr/bin/env python3
"""N80 hosting suspension: strictly read-only inventory for safe stop.
No raw config, credentials, member data or operation bodies in output.
"""
import base64, hashlib, json, os, stat, time
import paramiko
PIN='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU'
ROOT='/hosting/noastudio/noa-hub'
MAX=65536
t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
try:
 t.get_security_options().key_types=('ssh-ed25519',)
 t.start_client(timeout=20)
 fingerprint='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
 if fingerprint!=PIN:raise RuntimeError('host_identity_mismatch')
 t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
 s=paramiko.SFTPClient.from_transport(t)
 s.get_channel().settimeout(30)
 if s.normalize(ROOT)!=ROOT:raise RuntimeError('host_runtime_root_mismatch')
 def read(name,maxbytes=MAX):
  p=ROOT+'/'+name;st=s.lstat(p)
  if not stat.S_ISREG(st.st_mode) or st.st_size>maxbytes:
   raise RuntimeError('unsafe_or_oversize_'+name.replace('/','_'))
  with s.open(p,'rb') as f:bytes_=f.read(maxbytes+1)
  if len(bytes_)>maxbytes:raise RuntimeError('read_limit_exceeded')
  return bytes_,st
 def obj(name):
  b,st=read(name)
  j=json.loads(b.decode('utf-8'))
  if not isinstance(j,dict):raise RuntimeError('unexpected_nonobject_'+name)
  return j,hashlib.sha256(b).hexdigest(),st
 c,sha,cs= obj('control.json')
 ss,ssha,st=obj('status.json')
 source,srcsha,srcst=obj('source.json')
 runner,rs=read('runtime/runner.mjs',200000)
 compatible=b"read('control.json').stop===true" in runner and b"while(!stopping)" in runner
 try:
  lk=s.lstat(ROOT+'/runner.lock')
  lock_exists=stat.S_ISDIR(lk.st_mode) and not stat.S_ISLNK(lk.st_mode)
  pid_file_exists=False
  if lock_exists:
   try:
    p,_=read('runner.lock/pid',32)
    pid_file_exists=p.isdigit() and 2<=int(p)<=4194304
   except (OSError,RuntimeError):pass
 except OSError: lock_exists=False;pid_file_exists=False
 now=int(time.time())
 report={
  'mode':'read_only_no_writes','hostVerified':True,
  'runtimeDirVerified':True,'sourceRevision':source.get('revision'),
  'control':{
   'sha256':sha,'byteCount':cs.st_size,'modifiedEpoch':int(cs.st_mtime),
   'revision':c.get('revision'),'paused':c.get('paused'),
   'stop':c.get('stop'),'keyNames':sorted(c.keys()),
   'activeOperationCount':len(c.get('activeOperations',[])) if isinstance(c.get('activeOperations',[]),list) else None
  },
  'status':{
   'sha256':ssha,'modifiedEpoch':int(st.st_mtime),
   'heartbeatAgeSeconds':now-int(ss.get('heartbeatAt',0)) if isinstance(ss.get('heartbeatAt'),int) else None,
   'keyNames':sorted(ss.keys())
  },
  'runtime':{'runnerSha256':hashlib.sha256(runner).hexdigest(),
             'honorsStopFlag':compatible,
             'lockDirExists':lock_exists,'pidFileLooksValid':pid_file_exists},
  'canStopBySftpControl':compatible and isinstance(c.get('revision'),int)
    and type(c.get('paused')) is bool and isinstance(c.get('activeOperations'),list)
 }
 print('N80_SAFE_STOP_INSPECT='+json.dumps(report,ensure_ascii=False,separators=(',',':')))
finally:t.close()
