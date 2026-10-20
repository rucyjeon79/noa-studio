"""Publish the tested APK under an immutable name through pinned SFTP."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import urllib.request
import zipfile
import paramiko

apk=Path('artifact/app-debug.apk')
with zipfile.ZipFile(apk) as archive:
    if not {'AndroidManifest.xml','classes.dex'}.issubset(archive.namelist()):raise RuntimeError('Invalid APK')
number=os.environ['GITHUB_RUN_NUMBER']
if not re.fullmatch('[0-9]+',number):raise RuntimeError('Invalid build number')
name='noa-studio-android-build-'+number+'.apk'
data=apk.read_bytes();sha=hashlib.sha256(data).hexdigest()
transport=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
transport.get_security_options().key_types=('ssh-ed25519',)
try:
 transport.start_client(timeout=20)
 actual='SHA256:'+base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
 if actual!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('SSH key mismatch')
 transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
 sftp=paramiko.SFTPClient.from_transport(transport);root=os.environ['NOA_SSH_ROOT'].rstrip('/')
 if root!='/hosting/noastudio/html' or sftp.normalize(root)!=root:raise RuntimeError('Wrong root')
 def exists(path):
  try:sftp.lstat(path);return True
  except FileNotFoundError:return False
 def digest(path):
  with sftp.open(path,'rb') as f:
   f.prefetch(file_size=sftp.stat(path).st_size,max_concurrent_requests=8)
   return hashlib.sha256(f.read()).hexdigest()
 protected={p:digest(root+'/'+p) for p in ['index.php','common.php','config.php','data/dbconfig.php']}
 path=root+'/'+name
 if exists(path):
  if not stat.S_ISREG(sftp.lstat(path).st_mode) or digest(path)!=sha:raise RuntimeError('Existing APK differs')
 else:
  with sftp.open(path+'.upload','wx') as f:f.set_pipelined(True);f.write(data)
  if digest(path+'.upload')!=sha:raise RuntimeError('APK transfer mismatch')
  sftp.chmod(path+'.upload',0o644);sftp.rename(path+'.upload',path)
 if digest(path)!=sha:raise RuntimeError('Published APK hash mismatch')
 release=root+'/noa-android-release.json'
 if exists(release):
  if not stat.S_ISREG(sftp.lstat(release).st_mode):raise RuntimeError('Invalid release metadata')
  with sftp.open(release,'r') as f:old=json.load(f)
  if old.get('app')!='NOA STUDIO' or not re.fullmatch(r'noa-studio-android-build-[0-9]+[.]apk',old.get('file','')):raise RuntimeError('Unknown release metadata')
 metadata=json.dumps({'app':'NOA STUDIO','file':name,'sha256':sha,'build':number,'type':'verification-apk'},separators=(',',':')).encode()
 with sftp.open(release+'.upload','wx') as f:f.write(metadata)
 sftp.chmod(release+'.upload',0o644)
 if exists(release):sftp.posix_rename(release+'.upload',release)
 else:sftp.rename(release+'.upload',release)
 if protected!={p:digest(root+'/'+p) for p in protected}:raise RuntimeError('Protected files changed')
 sftp.close()
finally:transport.close()
url='https://noastudio.ai.kr/'+name
with urllib.request.urlopen(url,timeout=45) as response:
 if hashlib.sha256(response.read()).hexdigest()!=sha:raise RuntimeError('HTTP APK verification failed')
print('Tested APK published:',url,'bytes:',len(data),'sha256:',sha)
