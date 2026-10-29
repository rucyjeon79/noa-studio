"""Inspect EP31/32 through existing signed read operations. No repair actions."""
import hashlib,json,paramiko
from pathlib import Path
from noa_full_inventory import connect,ROOT
from noa_jukebox_recovery import signed_service

def main():
 t=connect()
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   with s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb') as f:key=f.read(129).strip().decode()
   with s.open(ROOT+'/noa-app/jukebox/upload.js','rb') as f:live=f.read()
 finally:t.close()
 if len(key)!=64:raise RuntimeError('invalid_worker_key')
 call=signed_service(key)
 catalog=call('export');queue=call('queue_snapshot');verified=call('verification_snapshot')['files']
 wanted=[r for r in catalog['items'] if r['title'] in ['사랑이 스며든 날','작은 떨림'] or str(r.get('ep','')).lstrip('0') in ['31','32']]
 report={'sourceMatchesRepository':hashlib.sha256(live).hexdigest()==hashlib.sha256(Path('deploy/noa-app/jukebox/upload.js').read_bytes()).hexdigest(),'businessWrites':0,'phoneLocalStorageAccessible':False,'songs':[]}
 for song in wanted:
  jobs=[j for j in queue['rows'] if j['song_key']==song['key']]
  record={k:song.get(k) for k in ['key','title','ep','genre']};record['verifiedAudio']=verified.get(song['key']);record['jobs']=[{k:j.get(k) for k in ['id','upload_id','status','uploaded_at','finished_at','error']} for j in jobs]
  if jobs:
   latest=max(jobs,key=lambda j:j['id']);q=call('upload_reconcile',{'id':latest['upload_id']})
   record['latestJobReconcile']={k:q.get(k) for k in ['status','final_verified','source_matches_final','source_verified','source_exists','total_chunks']}
   record['currentSongUpload']={k:q.get('public',{}).get('upload',{}).get(k) for k in ['id','status','updated_at','file_bytes','error']}
  report['songs'].append(record)
 print('EP_RESERVATION_AUDIT',json.dumps(report,ensure_ascii=False))
if __name__=='__main__':main()
