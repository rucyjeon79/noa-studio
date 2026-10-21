"""Pinned SSH: additive jukebox files, bounded public cover acquisition, SQL import.
Never executes arbitrary submitted commands or updates legacy music documents.
"""
import base64, hashlib, hmac, json, os, secrets, time, stat, subprocess, sys, urllib.request, urllib.error
from pathlib import Path
import paramiko
ROOT='/hosting/noastudio/html'
APP='noa-app/jukebox/'
NEW={APP+n:'deploy/'+APP+n for n in ['core.php','cli.php','stream.php','index.php','operations.php','service.php']}
INTEGRATE={'noa-bridge/catalog.php':'bridge/catalog.php','noa-music.php':'deploy/noa-music.php'}
BASE=json.loads(Path('scripts/noa_jukebox_baseline.json').read_text())

def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022));t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
 fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
 if fp!='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU':raise RuntimeError('SSH host mismatch; no credentials sent')
 t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD']);s=paramiko.SFTPClient.from_transport(t)
 try:
  if s.normalize(ROOT)!=ROOT:raise RuntimeError('unexpected production root')
  def read(path):
   try:
    if not stat.S_ISREG(s.lstat(path).st_mode):raise RuntimeError('not_regular_file')
    with s.open(path,'rb') as f:return f.read()
   except FileNotFoundError:return None
  def mkdir(path,mode=0o755):
   try:s.mkdir(path,mode)
   except OSError:
    if not stat.S_ISDIR(s.lstat(path).st_mode) or s.normalize(path)!=path:raise RuntimeError('unsafe directory')
  def atomic(path,data,expected):
   actual=read(path)
   if actual is not None and sha(actual)==sha(data):return
   if (sha(actual) if actual is not None else None)!=expected:raise RuntimeError('concurrent/unknown file: '+path)
   tmp=path+'.jukebox-stage-'+os.environ['GITHUB_RUN_ID']
   with s.open(tmp,'wx') as f:f.write(data)
   s.chmod(tmp,0o644)
   if sha(read(tmp))!=sha(data):raise RuntimeError('upload_checksum')
   if (sha(read(path)) if read(path) is not None else None)!=expected:raise RuntimeError('concurrent write')
   s.posix_rename(tmp,path)
   if sha(read(path))!=sha(data):raise RuntimeError('installed_checksum')
  protected={p:sha(read(ROOT+'/'+p)) for p in ['common.php','config.php','data/dbconfig.php','index.php','.htaccess'] if read(ROOT+'/'+p) is not None}
  mkdir(ROOT+'/noa-app');mkdir(ROOT+'/'+APP.rstrip('/'));mkdir(ROOT+'/noa-jukebox')
  atomic(ROOT+'/noa-jukebox/.htaccess',Path('deploy/'+APP+'media.htaccess').read_bytes(),None)
  # Install only new helpers; no existing application files are touched until SQL is ready.
  for remote,local in NEW.items():atomic(ROOT+'/'+remote,Path(local).read_bytes(),None)
  with s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb') as keyfile:key=keyfile.read(256).decode().strip()
  if len(key)!=64:raise RuntimeError('invalid_private_service_key')
  def cli(action,payload=None):
   body={'action':action,'payload':json.loads(payload) if payload else {}}
   raw=json.dumps(body,separators=(',',':')).encode();ts=str(int(time.time()));nonce=secrets.token_hex(16)
   msg='NOA-JUKEBOX-1\nPOST\n'+sha(raw)+'\n'+ts+'\n'+nonce
   headers={'Content-Type':'application/json','X-NOA-Timestamp':ts,'X-NOA-Nonce':nonce,
            'X-NOA-Signature':hmac.new(key.encode(),msg.encode(),hashlib.sha256).hexdigest()}
   req=urllib.request.Request('https://noastudio.ai.kr/noa-app/jukebox/service.php',data=raw,headers=headers,method='POST')
   try:
    with urllib.request.urlopen(req,timeout=150) as response:out=json.load(response)
   except urllib.error.HTTPError as e:
    raise RuntimeError('signed_service_'+action+'_http_'+str(e.code)) from None
   if not out.get('ok'):raise RuntimeError('signed_service_'+action+'_failed')
   result=out['result']
   if result.get('errors'):raise RuntimeError('import_validation_failed:'+json.dumps(result['errors']))
   return result
  work=Path('jukebox-proof');work.mkdir(exist_ok=True)
  catalog=cli('export');(work/'catalog-private.json').write_text(json.dumps(catalog,ensure_ascii=False))
  print('LIVE_DB_COUNTS '+json.dumps({k:v for k,v in catalog.items() if k!='items'}),flush=True)
  # SSH keepalive while acquisition happens on the worker, not on shared hosting.
  t.set_keepalive(20)
  results=[];saved=0;sql_saved=0
  for offset in range(0,len(catalog['items']),25):
   subprocess.run([sys.executable,'scripts/noa_jukebox_worker.py','--catalog',str(work/'catalog-private.json'),
                   '--root',str(work/'noa-jukebox'),'--report',str(work/'batch-private.json'),
                   '--offset',str(offset),'--limit','25','--workers','3'],check=True)
   batch=json.loads((work/'batch-private.json').read_text());results.extend(batch['results'])
   for row in batch['results']:
    for kind in ['cover','audio']:
     rel=row.get(kind+'_path')
     if not rel:continue
     local=work/'noa-jukebox'/rel;target=ROOT+'/noa-jukebox/'+rel;parent=ROOT+'/noa-jukebox'
     for part in Path(rel).parts[:-1]:parent+='/'+part;mkdir(parent)
     atomic(target,local.read_bytes(),None);saved+=1
   sql=cli('import',json.dumps(batch,ensure_ascii=False).encode());sql_saved+=sql['saved'];audit=cli('audit')
   progress={'total_suno_urls':len(catalog['items']),'processed':len(results),'cover_files':audit['covers'],
             'audio_files':audit['audio'],'audio_bytes':audit['audio_bytes'],'sql_saved':sql_saved,'complete':False}
   (work/'summary.json').write_text(json.dumps(progress,ensure_ascii=False,indent=2))
   print('JUKEBOX_BATCH_SAVED '+json.dumps(progress),flush=True)
  report={'results':results};sql={'saved':sql_saved};audit=cli('audit')
  # Exact known baseline plus private per-file backups protect simultaneous work.
  parent='/hosting/noastudio/noa-deploy-backups';mkdir(parent,0o700)
  backup=parent+'/jukebox-'+os.environ['GITHUB_RUN_ID'];mkdir(backup,0o700)
  changes=[]
  for remote,local in INTEGRATE.items():
   current=read(ROOT+'/'+remote);new=Path(local).read_bytes()
   if sha(current)==sha(new):continue
   if sha(current)!=BASE[remote]:raise RuntimeError('Integration changed; data saved but deployment paused: '+remote)
   target=backup+'/'+remote.replace('/','_')
   with s.open(target,'wx') as f:f.write(current)
   s.chmod(target,0o600)
   if sha(read(target))!=sha(current):raise RuntimeError('backup_checksum')
   changes.append((remote,new))
  for remote,new in changes:atomic(ROOT+'/'+remote,new,BASE[remote])
  for p,h in protected.items():
   if sha(read(ROOT+'/'+p))!=h:raise RuntimeError('protected file changed: '+p)
  result={'database_music_records':catalog['database_music_records'],'total_suno_urls':len(catalog['items']),
          'cover_files':audit['covers'],'audio_files':audit['audio'],'audio_bytes':audit['audio_bytes'],
          'sql_saved':sql['saved'],'files_uploaded':saved,'audit':audit,'deployed':list(NEW)+list(INTEGRATE),
          'source_commit':os.environ['GITHUB_SHA'],'existing_documents_modified':False,'audio_playback_verified':False}
  (work/'summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print('JUKEBOX_PRODUCTION_RESULT '+json.dumps(result),flush=True)
 finally:s.close();t.close()
if __name__=='__main__':main()
