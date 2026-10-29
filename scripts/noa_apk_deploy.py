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
import time
import paramiko

apk=Path('artifact/app-debug.apk')
with zipfile.ZipFile(apk) as archive:
    if not {'AndroidManifest.xml','classes.dex'}.issubset(archive.namelist()):raise RuntimeError('Invalid APK')
proof=json.loads(Path('artifact/verification.json').read_text())
number=str(proof['versionCode'])
if not re.fullmatch('[0-9]+',number):raise RuntimeError('Invalid build number')
if not 0<int(number)<=2100000000:raise RuntimeError('Invalid version code')
name='noa-studio-android-build-'+number+'.apk'
commit=os.environ['GITHUB_SHA'];run_id=os.environ['GITHUB_RUN_ID']
if not re.fullmatch('[a-f0-9]{40}',commit) or not re.fullmatch('[1-9][0-9]*',run_id):raise RuntimeError('Invalid release identity')
data=apk.read_bytes();sha=hashlib.sha256(data).hexdigest()
if proof.get('certificateSha256')!='f77427fe2f2e174aeac75e6734875b9106ee13072c49cfc8146b43075764271b' or proof.get('debuggable') is not False or proof['files']['noa-studio-release.apk']['sha256']!=sha:raise RuntimeError('Invalid signed release proof')
transport=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
transport.get_security_options().key_types=('ssh-ed25519',)
try:
 transport.start_client(timeout=20)
 actual='SHA256:'+base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
 if actual!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('SSH key mismatch')
 transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
 sftp=paramiko.SFTPClient.from_transport(transport);sftp.get_channel().settimeout(45);root=os.environ['NOA_SSH_ROOT'].rstrip('/')
 if root!='/hosting/noastudio/html' or sftp.normalize(root)!=root:raise RuntimeError('Wrong root')
 def exists(path):
  try:sftp.lstat(path);return True
  except FileNotFoundError:return False
 def digest(path):
  with sftp.open(path,'rb') as f:
   f.prefetch(file_size=sftp.stat(path).st_size,max_concurrent_requests=8)
   return hashlib.sha256(f.read()).hexdigest()
 protected={p:digest(root+'/'+p) for p in ['index.php','common.php','config.php','data/dbconfig.php']}
 release=root+'/noa-android-release.json'
 old_bytes=None
 if exists(release):
  if not stat.S_ISREG(sftp.lstat(release).st_mode):raise RuntimeError('Invalid release metadata')
  with sftp.open(release,'rb') as f:old_bytes=f.read(16385)
  if len(old_bytes)>16384:raise RuntimeError('Invalid release metadata size')
  old=json.loads(old_bytes)
  if old.get('app')!='NOA STUDIO' or not re.fullmatch(r'noa-studio-android-build-[0-9]+[.]apk',old.get('file','')):raise RuntimeError('Unknown release metadata')
  previous=int(old.get('versionCode',old.get('build',0)))
  if previous>int(number) or (previous==int(number) and old.get('sha256')!=sha):raise RuntimeError('Refusing stale or conflicting release')
 download=root+'/noa-download.php'
 download_candidate=Path('deploy/noa-download.php').read_bytes()
 download_sha=hashlib.sha256(download_candidate).hexdigest()
 before_download=digest(download)
 if before_download not in ('8932f580a08287ab356e93ffbcb135a3ab10b3bea7265d7d6bfbc8aed3771e40','931c416e50914abb9e609b20a4f99da5eed56656909d60ff18031be20d79e38a',download_sha):raise RuntimeError('Download page conflict; production preserved')
 # Only the reviewed n80 facade may be changed. Any other live version is protected.
 facade=root+'/noa-app/engine/n80.php'
 candidate=Path('deploy/noa-app/engine/n80.php').read_bytes()
 facade_sha=hashlib.sha256(candidate).hexdigest()
 if not stat.S_ISREG(sftp.lstat(facade).st_mode) or sftp.normalize(facade)!=facade:raise RuntimeError('Invalid n80 facade path')
 before_facade=digest(facade)
 if before_facade not in ('296443c5f348717bbae872f18450f970a359d74e0e021d2d635dcf7cc0776bc8',facade_sha):raise RuntimeError('N80 facade conflict; production preserved')
 path=root+'/'+name
 if exists(path):
  if not stat.S_ISREG(sftp.lstat(path).st_mode) or digest(path)!=sha:raise RuntimeError('Existing APK differs')
 else:
  with sftp.open(path+'.upload','wx') as f:f.set_pipelined(True);f.write(data)
  if digest(path+'.upload')!=sha:raise RuntimeError('APK transfer mismatch')
  sftp.chmod(path+'.upload',0o644);sftp.rename(path+'.upload',path)
 if digest(path)!=sha:raise RuntimeError('Published APK hash mismatch')
 # Verify public APK before advertising it to installed apps.
 url='https://noastudio.ai.kr/'+name
 with urllib.request.urlopen(url+'?verify='+run_id,timeout=45) as response:
  if response.status!=200 or hashlib.sha256(response.read()).hexdigest()!=sha:raise RuntimeError('HTTP APK verification failed')
 metadata=json.dumps({'schemaVersion':1,'app':'NOA STUDIO','applicationId':'kr.ai.noastudio','file':name,'sha256':sha,
  'build':number,'versionCode':int(number),'versionName':'2.0.'+number,'type':'release-apk','certificateSha256':proof['certificateSha256'],'requiresMigrationFromDebugBuild13':True,
  'engine':'n80','commit':commit,'runId':run_id,'publishedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())},separators=(',',':')).encode()
 def replace_checked(target,content,before):
  if exists(target):
   if not stat.S_ISREG(sftp.lstat(target).st_mode) or digest(target)!=before:raise RuntimeError('Concurrent release change')
  elif before is not None:raise RuntimeError('Release disappeared')
  temporary=target+'.'+run_id+'.upload'
  with sftp.open(temporary,'wx') as f:f.write(content)
  sftp.chmod(temporary,0o644)
  expected=hashlib.sha256(content).hexdigest()
  if digest(temporary)!=expected:raise RuntimeError('Upload hash mismatch')
  if exists(target):
   if digest(target)!=before:raise RuntimeError('Concurrent release change')
   sftp.posix_rename(temporary,target)
  else:sftp.rename(temporary,target)
  if digest(target)!=expected:raise RuntimeError('Replacement hash mismatch')
 if before_download!=download_sha:replace_checked(download,download_candidate,before_download)
 if before_facade!=facade_sha:replace_checked(facade,candidate,before_facade)
 replace_checked(release,metadata,hashlib.sha256(old_bytes).hexdigest() if old_bytes is not None else None)
 with urllib.request.urlopen('https://noastudio.ai.kr/noa-android-release.json?verify='+run_id,timeout=30) as response:
  if response.status!=200 or response.read()!=metadata:raise RuntimeError('Public release pointer verification failed')
 Path('artifact/n80-android-release.json').write_bytes(metadata)
 if protected!={p:digest(root+'/'+p) for p in protected}:raise RuntimeError('Protected files changed')
 sftp.close()
finally:transport.close()
url='https://noastudio.ai.kr/'+name
with urllib.request.urlopen(url,timeout=45) as response:
 if hashlib.sha256(response.read()).hexdigest()!=sha:raise RuntimeError('HTTP APK verification failed')
print('Tested APK published:',url,'bytes:',len(data),'sha256:',sha)
