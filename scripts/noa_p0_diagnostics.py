"""Production audit; never claims jobs, changes SQL, or replaces application files."""
import os,json,stat,time,hmac,secrets,hashlib,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,main as inventory,ROOT

def main():
 t=connect();s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(30)
 report={'commit':os.environ['GITHUB_SHA'],'paths':{},'probes':{},'sql_mutated':False,'workers_interrupted':False}
 try:
  for p in ['/hosting/noastudio','/hosting/noastudio/noa-deploy-backups',ROOT]:
   st=s.lstat(p);entries=s.listdir_attr(p)
   report['paths'][p]={'mode':oct(stat.S_IMODE(st.st_mode)),'uid':st.st_uid,'gid':st.st_gid,'normalized':s.normalize(p),'entries':len(entries),'directories':sum(stat.S_ISDIR(x.st_mode)for x in entries),'recent':[{'name':x.filename,'mtime':x.st_mtime,'bytes':x.st_size}for x in sorted(entries,key=lambda x:x.st_mtime,reverse=True)[:8]]}
  try:
   _,msg=s._request(paramiko.sftp.CMD_EXTENDED,'statvfs@openssh.com',ROOT)
   names=['block_size','fragment_size','blocks','blocks_free','blocks_available','inodes','inodes_free','inodes_available','fsid','flags','name_max']
   report['statvfs']=dict(zip(names,[msg.get_int64()for _ in names]))
  except Exception as e:report['statvfs_error']=type(e).__name__+': '+str(e)
  for parent in ['/hosting/noastudio/noa-deploy-backups','/hosting/noastudio']:
   p=parent+'/p0-preflight-'+os.environ['GITHUB_RUN_ID'];created=False
   try:
    s.mkdir(p,0o700);created=True
    with s.open(p+'/write-check','wx')as f:f.write(b'NOA reversible deployment preflight\n')
    with s.open(p+'/write-check','rb')as f:assert f.read()==b'NOA reversible deployment preflight\n'
    s.remove(p+'/write-check');report['probes'][parent]={'mkdir':True,'write_read':True}
   except Exception as e:report['probes'][parent]={'error':type(e).__name__+': '+str(e),'mkdir':created}
   finally:
    if created:s.rmdir(p)
  try:
   c=t.open_session(timeout=15);c.settimeout(20);c.exec_command('df -Pk /hosting/noastudio; df -Pi /hosting/noastudio; quota -s; command -v php; command -v ffmpeg; command -v crontab')
   report['host_tools']=c.makefile('rb').read(8192).decode(errors='replace');report['host_tools_status']=c.recv_exit_status();c.close()
  except Exception as e:report['host_tools_error']=type(e).__name__+': '+str(e)
  with s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb')as f:key=f.read(256).decode().strip()
  def service(action):
   raw=json.dumps({'action':action,'payload':{}},separators=(',',':')).encode();ts=str(int(time.time()));nonce=secrets.token_hex(16)
   msg='NOA-JUKEBOX-1\nPOST\n'+hashlib.sha256(raw).hexdigest()+'\n'+ts+'\n'+nonce
   req=urllib.request.Request('https://noastudio.ai.kr/noa-app/jukebox/service.php',data=raw,headers={'Content-Type':'application/json','X-NOA-Timestamp':ts,'X-NOA-Nonce':nonce,'X-NOA-Signature':hmac.new(key.encode(),msg.encode(),hashlib.sha256).hexdigest()})
   with urllib.request.urlopen(req,timeout=60)as r:return json.load(r)['result']
  for a in ['capabilities','integrity_snapshot','queue_snapshot']:
   try:
    result=service(a)
    if a=='queue_snapshot':result={k:v for k,v in result.items()if k!='rows'}|{'jobs':[{'id':r['id'],'status':r['status'],'error':r.get('error'),'attempt':r['attempt']}for r in result['rows']]}
    report[a]=result
   except Exception as e:report[a+'_error']=type(e).__name__+': '+str(e)
 finally:s.close();t.close()
 Path('full-release-proof').mkdir(exist_ok=True);Path('full-release-proof/preflight.json').write_text(json.dumps(report,indent=2));print('P0_PREFLIGHT '+json.dumps(report),flush=True)
 inventory()
if __name__=='__main__':main()
