"""Inventory active production mappings only; archive/Node source remains preserved."""
import os,json,hashlib,base64,stat,subprocess,shlex
from pathlib import Path
from collections import Counter
import paramiko
import noa_sftp_deploy as base
import noa_quality_deploy as quality
ROOT='/hosting/noastudio/html'
def sha(b):return hashlib.sha256(b).hexdigest()
def mappings():
 m={}
 for p in Path('deploy').glob('*'):
  if p.is_file() and p.suffix in ['.php','.js','.css','.json','.svg','.png'] and '.extend.' not in p.name:m[str(p.relative_to('deploy'))]=str(p)
 for p in Path('deploy/noa-app').rglob('*'):
  if p.is_file():m[str(p.relative_to('deploy'))]=str(p)
 for p in Path('deploy/theme/noa_studio').rglob('*'):
  if p.is_file():m[str(p.relative_to('deploy'))]=str(p)
 for p in Path('bridge').glob('*.php'):m['noa-bridge/'+p.name]=str(p)
 for local,remote in {**base.FILES,**quality.ASSET_FILES}.items():
  if Path(local).is_file() and not local.startswith('deploy/noastudio/'):m[remote]=local
 for local,remote in [('deploy/noa-home.extend.php','extend/noa.home.php'),('deploy/noa-design.extend.php','extend/noa.design.php'),('deploy/noa-database.extend.php','extend/noa.database.php')]:m[remote]=local
 return dict(sorted(m.items()))
def connect():
 t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022));t.use_compression(True);t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
 fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
 if fp!='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU':raise RuntimeError('host_key_mismatch')
 t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD']);return t
def main():
 m=mappings();t=connect();s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(30)
 private='/hosting/noastudio/noa-deploy-backups'
 if s.normalize(ROOT)!=ROOT or s.normalize(private)!=private:raise RuntimeError('unexpected_path')
 probe=private+'/full-inventory-'+os.environ['GITHUB_RUN_ID']+'.php'
 paths=list(m)
 # Private source hashing only: no database initialization or configuration reads.
 code="<?php $root="+json.dumps(ROOT)+";$paths=json_decode(base64_decode('"+base64.b64encode(json.dumps(paths).encode()).decode()+"'),true);$out=[];foreach($paths as $p){$f=$root.'/'.$p;$out[$p]=is_file($f)&&!is_link($f)?['sha256'=>hash_file('sha256',$f),'mtime'=>filemtime($f),'bytes'=>filesize($f)]:null;}echo 'FULL_HASH_JSON '.json_encode($out).PHP_EOL;"
 try:
  with s.open(probe,'wx') as f:f.write(code.encode())
  s.chmod(probe,0o600);ch=t.open_session(timeout=20);ch.settimeout(180);ch.exec_command('php '+shlex.quote(probe));out=ch.makefile('r').read().decode();status=ch.recv_exit_status()
  line=next((x for x in out.splitlines()if x.startswith('FULL_HASH_JSON ')),None)
  if status!=0 or not line:raise RuntimeError('private_hash_probe_failed')
  actual=json.loads(line.split(' ',1)[1]);rows=[]
  for remote,local in m.items():
   expected=sha(Path(local).read_bytes());a=actual[remote];state='missing' if a is None else 'match' if a['sha256']==expected else 'different'
   previous=None
   if state=='different':
    commits=subprocess.check_output(['git','log','--format=%H','--',local],text=True).splitlines()
    for commit in commits:
     try:b=subprocess.check_output(['git','show',commit+':'+local],stderr=subprocess.DEVNULL)
     except subprocess.CalledProcessError:continue
     if sha(b)==a['sha256']:previous=commit;break
   rows.append({'source':local,'remote':remote,'state':state,'sourceSha256':expected,'deployed':a,'knownPreviousCommit':previous})
  report={'sourceCommit':os.environ['GITHUB_SHA'],'rows':rows,'counts':dict(Counter(r['state']for r in rows)),'archivedLegacyFilesNotRuntimeTargets':sum(p.is_file()for p in Path('deploy/noastudio').rglob('*'))}
  Path('full-release-proof').mkdir(exist_ok=True)
  Path('full-release-proof/inventory.json').write_text(json.dumps(report,indent=2))
  print('FULL_INVENTORY_SUMMARY '+json.dumps({'commit':report['sourceCommit'],'counts':report['counts'],'differences':[r for r in rows if r['state']!='match']}),flush=True)
 finally:
  try:s.remove(probe)
  finally:t.close()
if __name__=='__main__':main()
