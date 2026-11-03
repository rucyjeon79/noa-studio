"""Patch reviewed display strings onto current production, preserving concurrent work."""
import hashlib,json,os,secrets,stat,subprocess,tempfile,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT

def digest(data):return hashlib.sha256(data).hexdigest()
def transform(data,changes):
 text=data.decode('utf-8');applied=[];absent=[]
 for c in changes:
  count=text.count(c['old'])
  if count:
   text=text.replace(c['old'],c['new']);applied.append({'old':c['old'],'new':c['new'],'count':count})
  elif c['new'] not in text:absent.append(c['old'])
 return text.encode(),applied,absent

def main():
 manifest=json.loads(Path('scripts/noa_plain_language_manifest.json').read_text())
 proof={'commit':os.environ['GITHUB_SHA'],'databaseWrites':0,'files':[],'notInstalled':[]}
 out=Path('plain-language-proof');out.mkdir(exist_ok=True)
 t=connect();t.set_keepalive(20)
 try:
  with paramiko.SFTPClient.from_transport(t,window_size=8388608) as s:
   s.get_channel().settimeout(60)
   if s.normalize(ROOT)!=ROOT:raise RuntimeError('unexpected_root')
   def read(path):
    info=s.lstat(ROOT+'/'+path)
    if not stat.S_ISREG(info.st_mode):raise RuntimeError('nonregular_source')
    with s.open(ROOT+'/'+path,'rb') as f:
     if info.st_size>32768:f.prefetch(file_size=info.st_size,max_concurrent_requests=16)
     return f.read()
   staged=[];activated=[]
   try:
    # Lint the actual live version after text substitutions, not an older checkout.
    with tempfile.TemporaryDirectory(prefix='noa-language-') as temp:
     for entry in manifest['files']:
      path=entry['remote']
      if '..' in path.split('/') or path.startswith('/'):raise RuntimeError('invalid_manifest_path')
      try:before=read(path)
      except FileNotFoundError:proof['notInstalled'].append(path);continue
      after,changes,absent=transform(before,entry['changes'])
      row={'path':path,'before':digest(before),'after':digest(after),'changes':changes,'notPresentInLiveVersion':absent}
      proof['files'].append(row)
      if after==before:continue
      local=Path(temp)/path;local.parent.mkdir(parents=True,exist_ok=True);local.write_bytes(after)
      subprocess.run(['php','-l',str(local)] if path.endswith('.php') else ['node','--check',str(local)],check=True,capture_output=True)
      stage=path+'.language-'+os.environ['GITHUB_RUN_ID']
      with s.open(ROOT+'/'+stage,'wx') as f:f.set_pipelined(True);f.write(after)
      s.chmod(ROOT+'/'+stage,0o644)
      staged.append((path,stage,before,after))
      if read(stage)!=after:raise RuntimeError('stage_mismatch')
     for path,stage,before,after in staged:
      if read(path)!=before:raise RuntimeError('concurrent_source_preserved:'+path)
     for path,stage,before,after in staged:
      if read(path)!=before:raise RuntimeError('concurrent_source_preserved:'+path)
      s.posix_rename(ROOT+'/'+stage,ROOT+'/'+path);activated.append((path,before,after))
      if read(path)!=after:raise RuntimeError('activation_mismatch')
    # Invalidate only the edited PHP files through a short-lived authenticated endpoint.
    token=secrets.token_hex(32);name='noa-language-refresh-'+secrets.token_hex(12)+'.php'
    paths=[p for p,_,_ in activated if p.endswith('.php')]
    code="<?php if(!hash_equals('"+digest(token.encode())+"',hash('sha256',$_SERVER['HTTP_X_NOA_REFRESH']??''))){http_response_code(403);exit;} header('Content-Type: application/json');$out=[];foreach("+"json_decode("+repr(json.dumps(paths))+",true)"+" as $p){$out[$p]=function_exists('opcache_invalidate')?opcache_invalidate(__DIR__.'/'.$p,true):null;}echo json_encode(['ok'=>true,'files'=>$out]);"
    try:
     with s.open(ROOT+'/'+name,'wx') as f:f.write(code.encode())
     s.chmod(ROOT+'/'+name,0o644)
     req=urllib.request.Request('https://noastudio.ai.kr/'+name,headers={'X-NOA-Refresh':token})
     with urllib.request.urlopen(req,timeout=60) as r:proof['phpRefresh']=json.load(r)
    finally:s.remove(ROOT+'/'+name)
    for row in proof['files']:
     if row['path'].endswith('.js'):
      req=urllib.request.Request('https://noastudio.ai.kr/'+row['path']+'?language='+os.environ['GITHUB_SHA'][:12],headers={'Cache-Control':'no-cache'})
      with urllib.request.urlopen(req,timeout=45) as r:
       if digest(r.read())!=row['after']:raise RuntimeError('public_script_mismatch:'+row['path'])
    proof['changedFiles']=len(activated)
    proof['changedOccurrences']=sum(c['count'] for f in proof['files'] for c in f['changes'])
    proof['ok']=True
   except Exception:
    # Restore only bytes owned by this release; newer concurrent versions stay intact.
    for path,before,after in reversed(activated):
     if read(path)!=after:continue
     rollback=path+'.language-rollback-'+os.environ['GITHUB_RUN_ID']
     with s.open(ROOT+'/'+rollback,'wx') as f:f.write(before)
     s.chmod(ROOT+'/'+rollback,0o644);s.posix_rename(ROOT+'/'+rollback,ROOT+'/'+path)
    raise
   finally:
    for _,stage,_,_ in staged:
     try:s.remove(ROOT+'/'+stage)
     except FileNotFoundError:pass
    (out/'deployment.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2))
 finally:t.close()
 print('PLAIN_LANGUAGE_DEPLOYED',json.dumps({k:v for k,v in proof.items() if k!='files'},ensure_ascii=False))
if __name__=='__main__':main()
