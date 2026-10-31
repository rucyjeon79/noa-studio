"""Fill missing covers from public Suno song metadata, never process or replace audio."""
import concurrent.futures,hashlib,json,os,secrets,time,urllib.request,urllib.error
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
from noa_jukebox_worker import metadata,cover
from noa_jukebox_publish import publish_final
from n80_live_observer import NoRedirect
from pathlib import PurePosixPath

def retry_key(row):
 return hashlib.sha256((row['key']+'|'+row['sunoUrl']).encode()).hexdigest()

def due_rows(rows,state,now,limit=20):
 return sorted((r for r in rows if state.get(retry_key(r),{}).get('next',0)<=now),key=lambda r:state.get(retry_key(r),{}).get('next',0))[:limit]

def failed_attempt(state,row,now):
 k=retry_key(row);n=min(10,state.get(k,{}).get('attempts',0)+1)
 state[k]={'attempts':n,'next':now+min(86400,900*2**(n-1))}

def main():
 out=Path('cover-proof');out.mkdir(exist_ok=True);work=Path(os.environ['RUNNER_TEMP'])/'noa-cover-fill';work.mkdir(exist_ok=True)
 retry_file=out/'retry.json'
 try:state=json.loads(retry_file.read_text())
 except (FileNotFoundError,json.JSONDecodeError):state={}
 token=secrets.token_hex(32);name='cover-fill-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name
 code=Path('scripts/noa_suno_card_auto.php').read_text().replace('NOA_COVER_EXPIRY',str(int(time.time())+1500)).replace('NOA_COVER_TOKEN_SHA',hashlib.sha256(token.encode()).hexdigest()).encode()
 t=connect();installed=False;report={'recovered':[],'unavailable':[],'audioFilesChanged':0,'scheduledAutoFill':True}
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   s.get_channel().settimeout(45)
   try:
    with s.open(remote,'wx') as f:f.write(code)
    installed=True;s.chmod(remote,0o644)
    with s.open(remote,'rb') as f:assert f.read()==code
    def call(body):
     req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=json.dumps(body).encode(),headers={'Content-Type':'application/json','X-NOA-Control':token})
     try:
      with urllib.request.build_opener(NoRedirect()).open(req,timeout=60) as r:data=json.load(r)
     except urllib.error.HTTPError as e:
      try:reason=e.headers.get('X-NOA-Cover-Error') or json.load(e).get('error','control_http_'+str(e.code))
      except Exception:reason='control_http_'+str(e.code)
      raise ValueError(reason) from None
     assert data['ok'];return data
    inventory=call({'action':'inventory'});all_rows=inventory['rows'];state={k:v for k,v in state.items() if k in {retry_key(r) for r in all_rows}};rows=due_rows(all_rows,state,time.time());report['before']={k:v for k,v in inventory.items() if k!='rows'};report['candidates']=len(all_rows);report['attempted']=len(rows);report['deferred']=len(all_rows)-len(rows)
    def acquire(row):
     keyhash=hashlib.sha256(row['key'].encode()).hexdigest()
     try:
      meta=metadata(row['sunoUrl']);local=work/keyhash/'cover.webp';info=cover(local,meta['image_url']);return row,meta,info,local,None
     except Exception as e:return row,None,None,None,type(e).__name__+':'+str(e)[:120]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
     for row,meta,info,local,error in pool.map(acquire,rows):
      keyhash=hashlib.sha256(row['key'].encode()).hexdigest()
      if error:failed_attempt(state,row,time.time());report['unavailable'].append({'keyHash':keyhash,'title':row['title'],'sunoUrl':row['sunoUrl'],'reason':error});continue
      relative=row['coverPath'];base=row['targetBase']
      if base not in ['/hosting/noastudio/noa-jukebox-private/media',ROOT+'/noa-jukebox'] or '..' in PurePosixPath(relative).parts or relative.startswith('/'):raise ValueError('invalid_media_target')
      try:
       for folder in [str(p) for p in reversed(PurePosixPath(base+'/'+relative).parent.parents) if str(p).startswith(base+'/')]+[str(PurePosixPath(base+'/'+relative).parent)]:
        try:s.mkdir(folder,0o700)
        except IOError:assert s.normalize(folder)==folder
       publish_final(s,local,base+'/'+relative,info['cover_sha256'],owner='cover-fill')
       record={'song_key':row['key'],'source_url':row['sunoUrl'],'suno_id':meta['suno_id'],'suno_title':meta['suno_title'],**{k:info[k] for k in ['cover_bytes','cover_sha256']},'cover_path':relative}
       applied=call({'action':'apply','revision':row['revision'],'ownerId':row['ownerId'],'record':record});assert applied['audioPreserved']
       if applied['public']:
        with urllib.request.urlopen(applied['coverUrl'],timeout=30) as r:assert hashlib.sha256(r.read()).hexdigest()==info['cover_sha256']
       state.pop(retry_key(row),None);report['recovered'].append({'keyHash':keyhash,'verified':True})
      except Exception as e:failed_attempt(state,row,time.time());report['unavailable'].append({'keyHash':keyhash,'title':row['title'],'sunoUrl':row['sunoUrl'],'reason':type(e).__name__+':'+str(e)[:120]})
      (out/'result.json').write_text(json.dumps(report,indent=2));print('COVER_FILL_PROGRESS',len(report['recovered']),len(report['unavailable']),flush=True)
    after=call({'action':'inventory'});report['after']={k:v for k,v in after.items() if k!='rows'};report['remaining']=len(after['rows'])
   finally:
    if installed:s.remove(remote)
 finally:
  t.close();retry_file.write_text(json.dumps(state));(out/'result.json').write_text(json.dumps(report,indent=2));print('COVER_FILL_RESULT',json.dumps({k:len(v) if isinstance(v,list) else v for k,v in report.items()}))
if __name__=='__main__':main()
