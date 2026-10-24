"""Read-only final usage and backup absence evidence; no installation or mutations."""
import os,json,hashlib,base64,stat,sys,subprocess
from pathlib import Path
import paramiko
sys.path.insert(0,str(Path(__file__).resolve().parent))
from n80_app_integration import call
SQL=['15133165eb1e1d6529158ed051d94e9a.sql','fda4138b6ba4d525f337e4a86038218f.sql','d54c43955754a84d1fca3778345f37a0.sql','ce1beb1a0ad64e9dc4b50654625c6618.sql','362dfee5ef4c3df496fdbc83cb482a5a.sql']
report={'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'auditRun':os.environ['GITHUB_RUN_ID'],'serverWrites':0,'sqlMutations':0,'stoppedJobs':0,'folderUsage':{}}
t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
try:
 t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=30)
 fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
 if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('host_key_mismatch')
 t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
 with paramiko.SFTPClient.from_transport(t)as s:
  s.get_channel().settimeout(45);root='/hosting/noastudio';html=root+'/html'
  if s.normalize(root)!=root:raise RuntimeError('unexpected_root')
  entries={x.filename:x for x in s.listdir_attr(root+'/noa-db-private')}
  report['sqlBackupsRemaining']=[n for n in SQL if n in entries]
  report['sqlMetadataRemaining']=[n[:-4]+'.json'for n in SQL if n[:-4]+'.json'in entries]
  report['sqlDirectoryRemainingNames']=sorted(entries)
  report['uiTemporaryFilesAtRoot']=[x.filename for x in s.listdir_attr(html)if x.filename.startswith('.noa-')and any(tag in x.filename for tag in ['.tmp','.stage','-stage-'])]
  for entry in s.listdir_attr(root):
   if not stat.S_ISDIR(entry.st_mode):continue
   count=0;total=0;stack=[root+'/'+entry.filename]
   while stack:
    path=stack.pop()
    for item in s.listdir_attr(path):
     if stat.S_ISDIR(item.st_mode):stack.append(path+'/'+item.filename)
     elif stat.S_ISREG(item.st_mode):count+=1;total+=item.st_size
   report['folderUsage'][entry.filename]={'files':count,'bytes':total}
  with s.open(html+'/noa-app/home.php','rb')as f:report['homePhpSha256']=hashlib.sha256(f.read()).hexdigest()
  with s.open(root+'/noa-ai-lab/worker.key','rb')as f:key=f.read(256).strip()
  if len(key)!=64:raise RuntimeError('invalid_service_key')
 report['dataAudit']=call(key);del key
 report['sqlHostCopiesAbsent']=not report['sqlBackupsRemaining']and not report['sqlMetadataRemaining']
 report['ok']=report['sqlHostCopiesAbsent']and not report['uiTemporaryFilesAtRoot']and report['dataAudit'].get('integrityOk',False)
 Path('noa-final-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print('NOA_FINAL_READONLY_AUDIT '+json.dumps({'ok':report['ok'],'sqlCopiesAbsent':report['sqlHostCopiesAbsent'],'uiTemporaryFiles':len(report['uiTemporaryFilesAtRoot']),'dataIntegrity':report['dataAudit'].get('integrityOk'),'writes':0}))
finally:t.close()
