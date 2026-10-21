"""Pinned SSH: additive jukebox files, bounded public cover acquisition, SQL import.
Never executes arbitrary submitted commands or updates legacy music documents.
"""
import base64, hashlib, hmac, json, os, re, secrets, time, stat, subprocess, sys, shutil, urllib.request, urllib.error
from pathlib import Path
import paramiko
import noa_jukebox_owned as owned
from noa_jukebox_upload_worker import process_uploads
ROOT='/hosting/noastudio/html'
APP='noa-app/jukebox/'
NEW={APP+n:'deploy/'+APP+n for n in ['queue-core.php','core.php','cli.php','stream.php','index.php','operations.php','service.php','upload-core.php','upload.php','download.php','upload.js','upload.css','mobile-check.php']}
INTEGRATE={'noa-bridge/catalog.php':'bridge/catalog.php','noa-music.php':'deploy/noa-music.php'}
BASE=json.loads(Path('scripts/noa_jukebox_baseline.json').read_text())

def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022));t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
 fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
 if fp!='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU':raise RuntimeError('SSH host mismatch; no credentials sent')
 t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD']);s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(90)
 try:
  if s.normalize(ROOT)!=ROOT:raise RuntimeError('unexpected production root')
  def read(path):
   try:
    if not stat.S_ISREG(s.lstat(path).st_mode):raise RuntimeError('not_regular_file')
    with s.open(path,'rb') as f:return f.read()
   except FileNotFoundError:return None
  known_directories=set()
  def mkdir(path,mode=0o755):
   if path in known_directories:return
   try:s.mkdir(path,mode)
   except OSError:
    if not stat.S_ISDIR(s.lstat(path).st_mode) or s.normalize(path)!=path:raise RuntimeError('unsafe directory')
   known_directories.add(path)
  def atomic(path,data,expected):
   actual=read(path)
   if actual is not None and sha(actual)==sha(data):return
   if (sha(actual) if actual is not None else None)!=expected:raise RuntimeError('concurrent/unknown file: '+path)
   tmp=path+'.jukebox-stage-'+os.environ['GITHUB_RUN_ID']+'-'+os.environ.get('GITHUB_JOB','release')
   with s.open(tmp,'wx') as f:f.write(data)
   s.chmod(tmp,0o644)
   if sha(read(tmp))!=sha(data):raise RuntimeError('upload_checksum')
   if (sha(read(path)) if read(path) is not None else None)!=expected:raise RuntimeError('concurrent write')
   s.posix_rename(tmp,path)
   if sha(read(path))!=sha(data):raise RuntimeError('installed_checksum')
  if os.environ.get('NOA_JUKEBOX_INTERFACE_ONLY')=='1':
   # UI and its backwards-compatible partial-upload API can publish without
   # waiting for, claiming, canceling or restarting the ongoing audio worker.
   files={APP+n:'deploy/'+APP+n for n in ['upload-core.php','upload.php','upload.js','upload.css','index.php']}
   files['noa-music.php']='deploy/noa-music.php'
   protected={p:sha(read(ROOT+'/'+p)) for p in ['common.php','config.php','data/dbconfig.php','index.php','.htaccess'] if read(ROOT+'/'+p) is not None}
   parent='/hosting/noastudio/noa-deploy-backups';mkdir(parent,0o700)
   backup=parent+'/jukebox-interface-'+os.environ['GITHUB_RUN_ID'];mkdir(backup,0o700)
   changes=[]
   for remote,local in files.items():
    current=read(ROOT+'/'+remote);new=Path(local).read_bytes()
    if current is None:raise RuntimeError('existing_jukebox_required')
    if sha(current)==sha(new):continue
    if sha(current) not in BASE[remote]:raise RuntimeError('unknown_interface_baseline:'+remote)
    target=backup+'/'+remote.replace('/','_')
    with s.open(target,'wx') as f:f.write(current)
    s.chmod(target,0o600)
    if sha(read(target))!=sha(current):raise RuntimeError('backup_checksum')
    changes.append((remote,new,sha(current)))
   for remote,new,previous in changes:atomic(ROOT+'/'+remote,new,previous)
   if any(sha(read(ROOT+'/'+p))!=h for p,h in protected.items()):raise RuntimeError('protected_file_changed')
   result={'source_commit':os.environ['GITHUB_SHA'],'deployed_hashes':{remote:sha(read(ROOT+'/'+remote)) for remote in files},'protected_files_unchanged':True,'sql_queue_mutated':False,'audio_worker_interrupted':False}
   work=Path('jukebox-proof');work.mkdir(exist_ok=True);(work/'interface.json').write_text(json.dumps(result));print('JUKEBOX_INTERFACE_RESULT '+json.dumps(result),flush=True);return
  protected={p:sha(read(ROOT+'/'+p)) for p in ['common.php','config.php','data/dbconfig.php','index.php','.htaccess'] if read(ROOT+'/'+p) is not None}
  mkdir(ROOT+'/noa-app');mkdir(ROOT+'/'+APP.rstrip('/'));mkdir(ROOT+'/noa-jukebox')
  atomic(ROOT+'/noa-jukebox/.htaccess',Path('deploy/'+APP+'media.htaccess').read_bytes(),None)
  # Install only new helpers; no existing application files are touched until SQL is ready.
  for remote,local in NEW.items():
   expected=BASE.get(remote)
   if isinstance(expected,list):
    current=read(ROOT+'/'+remote);actual=sha(current) if current is not None else None
    expected=actual if actual in expected else None
   atomic(ROOT+'/'+remote,Path(local).read_bytes(),expected)
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
  try:
   probe=t.open_session(timeout=20);probe.settimeout(20)
   probe.exec_command('for tool in php php8.2 php82 ffmpeg ffprobe crontab; do command -v "$tool" || true; done; crontab -l >/dev/null 2>&1; printf "cron_read_status=%s\\n" "$?"')
   host_probe=probe.makefile('r').read(4096).decode(errors='replace');probe.close()
  except Exception:host_probe='SSH executable probe unavailable; external worker retained'
  print('DOTHOME_EXECUTABLE_PROBE '+json.dumps(host_probe),flush=True)
  pending=cli('jobs')
  if os.environ.get('GITHUB_EVENT_NAME')=='schedule' and not pending['queued'] and not pending['uploads']:
   (work/'summary.json').write_text(json.dumps({'idle':True,'queued':0}));print('JUKEBOX_IDLE');return
  claimed=cli('claim')['ids']
  catalog=cli('export');(work/'catalog-private.json').write_text(json.dumps(catalog,ensure_ascii=False))
  print('LIVE_DB_COUNTS '+json.dumps({k:v for k,v in catalog.items() if k!='items'}),flush=True)
  # SSH keepalive while acquisition happens on the worker, not on shared hosting.
  t.set_keepalive(20)
  # Exact known baseline plus private per-file backups protect simultaneous work.
  parent='/hosting/noastudio/noa-deploy-backups';mkdir(parent,0o700)
  backup=parent+'/jukebox-'+os.environ['GITHUB_RUN_ID'];mkdir(backup,0o700)
  changes=[]
  for remote,local in INTEGRATE.items():
   current=read(ROOT+'/'+remote);new=Path(local).read_bytes()
   if sha(current)==sha(new):continue
   allowed=BASE[remote] if isinstance(BASE[remote],list) else [BASE[remote]]
   if sha(current) not in allowed:raise RuntimeError('Integration changed; data saved but deployment paused: '+remote)
   target=backup+'/'+remote.replace('/','_')
   with s.open(target,'wx') as f:f.write(current)
   s.chmod(target,0o600)
   if sha(read(target))!=sha(current):raise RuntimeError('backup_checksum')
   changes.append((remote,new,sha(current)))
  for remote,new,previous in changes:atomic(ROOT+'/'+remote,new,previous)
  original_data=cli('integrity_snapshot')
  if os.environ.get('GITHUB_EVENT_NAME')!='schedule':cli('qa_setup')
  if pending['uploads'] and not shutil.which('ffmpeg'):
   subprocess.run(['sudo','apt-get','update','-qq'],check=True)
   subprocess.run(['sudo','apt-get','install','-y','ffmpeg'],check=True)
  print('HOST_CAPABILITIES '+json.dumps(cli('capabilities')),flush=True)
  def source_reader(job,destination):
   # One fixed read-only command, with a server-generated hex ID as its only
   # variable. The pinned SSH identity and source SHA remain unchanged.
   if not re.fullmatch('[a-f0-9]{32}',job['id']):raise ValueError('invalid_upload_id')
   channel=None
   try:
    channel=t.open_session(window_size=16*1024*1024,timeout=20);channel.settimeout(90)
    channel.exec_command('cat /hosting/noastudio/noa-jukebox-private/incoming/'+job['id']+'/input.audio')
    total=0
    with channel.makefile('rb') as src,destination.open('xb') as dst:
     while True:
      data=src.read(1024*1024)
      if not data:break
      total+=len(data)
      if total>job['bytes']:raise ValueError('uploaded_input_grew')
      dst.write(data)
    if channel.recv_exit_status()!=0 or total!=job['bytes']:raise OSError('fixed_source_read_unavailable')
    return True
   except ValueError:raise
   except Exception:destination.unlink(missing_ok=True);return False
   finally:
    if channel:channel.close()
  uploads=process_uploads(s,lambda action,payload=None:cli(action,json.dumps(payload,ensure_ascii=False).encode() if payload else None),mkdir,source_reader)

  print('JUKEBOX_UPLOAD_RESULT '+json.dumps(uploads),flush=True)
  results=[];saved=0;sql_saved=0
  for offset in (range(0,len(catalog['items']),25) if claimed else []):
   inputs,owned_folder=owned.stage(s,catalog['items'][offset:offset+25],work)
   source_map=work/'owned-private.json';source_map.write_text(json.dumps(inputs))
   try:
    subprocess.run([sys.executable,'scripts/noa_jukebox_worker.py','--catalog',str(work/'catalog-private.json'),
                    '--root',str(work/'noa-jukebox'),'--report',str(work/'batch-private.json'),
                    '--offset',str(offset),'--limit','25','--workers','3','--sources',str(source_map)],check=True)
   finally:
    owned.cleanup(owned_folder);source_map.unlink(missing_ok=True)
   batch=json.loads((work/'batch-private.json').read_text());results.extend(batch['results'])
   for row in batch['results']:
    for kind in ['cover','audio']:
     rel=row.get(kind+'_path')
     if not rel or (row.get('cached_cover') and kind=='cover'):continue
     local=work/'noa-jukebox'/rel;target=ROOT+'/noa-jukebox/'+rel;parent=ROOT+'/noa-jukebox'
     for part in Path(rel).parts[:-1]:parent+='/'+part;mkdir(parent)
     existing=read(target)
     if existing is not None:
      if sha(existing)!=row[kind+'_sha256']:raise RuntimeError('existing_media_preserved:'+rel)
     else:
      # The signed PHP import hashes and decodes before SQL publication.
      tmp=target+'.stage-'+os.environ['GITHUB_RUN_ID']
      with s.open(tmp,'wx') as f:
       f.set_pipelined(True);f.write(local.read_bytes())
      s.chmod(tmp,0o644);s.rename(tmp,target)
     saved+=1
   sql=cli('import',json.dumps(batch,ensure_ascii=False).encode());sql_saved+=sql['saved'];audit=cli('audit')
   progress={'total_suno_urls':len(catalog['items']),'processed':len(results),'cover_files':audit['covers'],
             'audio_files':audit['audio'],'audio_bytes':audit['audio_bytes'],'sql_saved':sql_saved,'complete':False}
   (work/'summary.json').write_text(json.dumps(progress,ensure_ascii=False,indent=2))
   print('JUKEBOX_BATCH_SAVED '+json.dumps(progress),flush=True)
  report={'results':results};sql={'saved':sql_saved};audit=cli('audit')
  for p,h in protected.items():
   if sha(read(ROOT+'/'+p))!=h:raise RuntimeError('protected file changed: '+p)
  result={'catalog_song_records':catalog.get('catalog_song_records'),'database_music_records':catalog['database_music_records'],'total_suno_urls':len(catalog['items']),
          'cover_files':audit['covers'],'audio_files':audit['audio'],'audio_bytes':audit['audio_bytes'],
          'source_audits':sum('audio_discovery' in r for r in results),'cover_pending':len(catalog['items'])-audit['covers'],'audio_pending':len(catalog['items'])-audit['audio'],'sql_saved':sql['saved'],'files_uploaded':saved,'audit':audit,'deployed':list(NEW)+list(INTEGRATE),
          'host_executable_probe':host_probe,'queue':cli('queue_snapshot'),'capacity':cli('capabilities'),'source_commit':os.environ['GITHUB_SHA'],'uploads':uploads,'integrity_before':original_data,'integrity_after':cli('integrity_snapshot'),'existing_documents_modified':False,'audio_playback_verified':False}
  cli('finish',json.dumps({'ids':claimed}).encode())
  (work/'summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print('JUKEBOX_PRODUCTION_RESULT '+json.dumps(result),flush=True)
 finally:s.close();t.close()
if __name__=='__main__':main()
