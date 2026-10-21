"""Reclaim only two known corrupt synthetic QA inputs created by this task.

Never deletes a catalogue source, confirmed MP3, image or unknown byte sequence.
The original SQL failed-attempt records are retained.
"""
import base64,hashlib,hmac,json,os,re,secrets,stat,time,urllib.request
import paramiko

OWNED={
 'ae1eda78a29170ddf8dce4f99571dfba':'jukebox:qa:fifo-01',
 '9bcb5da86288f95f9962916ee3885509':'jukebox:qa:fifo-10',
}
EXPECTED='e54dec2379a37d2edf806b43d8077840d5a5be753f8dceac624ee064bab9a3a3'
BASE='/hosting/noastudio/noa-jukebox-private/incoming/'

def main():
 transport=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022));transport.get_security_options().key_types=('ssh-ed25519',);transport.start_client(timeout=20)
 fingerprint='SHA256:'+base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
 if fingerprint!='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU':raise RuntimeError('pinned_host_mismatch')
 transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD']);sftp=paramiko.SFTPClient.from_transport(transport);sftp.get_channel().settimeout(60)
 try:
  with sftp.open('/hosting/noastudio/noa-ai-lab/worker.key','rb') as f:key=f.read(256).decode().strip()
  raw=b'{"action":"queue_snapshot","payload":{}}';ts=str(int(time.time()));nonce=secrets.token_hex(16);message='NOA-JUKEBOX-1\nPOST\n'+hashlib.sha256(raw).hexdigest()+'\n'+ts+'\n'+nonce
  request=urllib.request.Request('https://noastudio.ai.kr/noa-app/jukebox/service.php',data=raw,method='POST',headers={'Content-Type':'application/json','X-NOA-Timestamp':ts,'X-NOA-Nonce':nonce,'X-NOA-Signature':hmac.new(key.encode(),message.encode(),hashlib.sha256).hexdigest()})
  with urllib.request.urlopen(request,timeout=60) as response:queue=json.load(response)['result']['rows']
  removed=[];reclaimed=0
  for upload_id,song_key in OWNED.items():
   if not any(r['upload_id']==upload_id and r['song_key']==song_key and r['status']=='failed' and r['error']=='media_command_failed' for r in queue):continue
   path=BASE+upload_id+'/input.audio'
   try:info=sftp.lstat(path)
   except FileNotFoundError:continue
   if not stat.S_ISREG(info.st_mode) or sftp.normalize(BASE+upload_id)!=BASE+upload_id:raise RuntimeError('unsafe_qa_input')
   channel=transport.open_session(window_size=16*1024*1024,timeout=20);channel.settimeout(90);channel.exec_command('cat '+path);digest=hashlib.sha256();total=0
   try:
    with channel.makefile('rb') as source:
     while True:
      block=source.read(1024*1024)
      if not block:break
      total+=len(block)
      if total>info.st_size:raise RuntimeError('qa_input_changed')
      digest.update(block)
    status=channel.recv_exit_status()
   finally:channel.close()
   if status or total!=info.st_size or digest.hexdigest()!=EXPECTED:raise RuntimeError('unknown_input_preserved')
   sftp.remove(path);removed.append(upload_id);reclaimed+=info.st_size
  parent='/hosting/noastudio/noa-deploy-backups';probe=parent+'/recovery-probe-'+os.environ['GITHUB_RUN_ID'];writable=False
  try:sftp.mkdir(probe,0o700);sftp.rmdir(probe);writable=True
  except OSError:pass
  result={'removed_owned_corrupt_qa_inputs':len(removed),'reclaimed_bytes':reclaimed,'backup_directory_writable':writable,'catalogue_sources_removed':0,'confirmed_mp3_removed':0,'sql_history_modified':False}
  print('JUKEBOX_STORAGE_RESCUE '+json.dumps(result),flush=True)
 finally:sftp.close();transport.close()

if __name__=='__main__':main()
