"""Read-only final service snapshots; no job claim, import, schema or queue maintenance."""
import os,json,time,hmac,secrets,hashlib,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect
def main():
 t=connect();s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(30)
 try:
  with s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb')as f:key=f.read(256).decode().strip()
  result={'commit':os.environ['GITHUB_SHA'],'sqlWrites':False,'workersStopped':False}
  for action in ['integrity_snapshot','queue_snapshot','capabilities']:
   raw=json.dumps({'action':action,'payload':{}},separators=(',',':')).encode();ts=str(int(time.time()));nonce=secrets.token_hex(16)
   msg='NOA-JUKEBOX-1\nPOST\n'+hashlib.sha256(raw).hexdigest()+'\n'+ts+'\n'+nonce
   req=urllib.request.Request('https://noastudio.ai.kr/noa-app/jukebox/service.php',data=raw,headers={'Content-Type':'application/json','X-NOA-Timestamp':ts,'X-NOA-Nonce':nonce,'X-NOA-Signature':hmac.new(key.encode(),msg.encode(),hashlib.sha256).hexdigest()})
   with urllib.request.urlopen(req,timeout=90)as r:body=json.load(r)['result']
   if action=='queue_snapshot':body={k:v for k,v in body.items()if k!='rows'}
   result[action]=body
  result['originalDocumentsMatchBefore']=result['integrity_snapshot']['documents_sha256']=='79661fa849e474a534b69d836a46498fbc9d62c3848f3445490c375cf8beffa9'
  result['checkedAtUTC']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
  Path('full-release-proof').mkdir(exist_ok=True);Path('full-release-proof/postflight.json').write_text(json.dumps(result,indent=2));print('P0_POSTFLIGHT '+json.dumps(result),flush=True)
 finally:s.close();t.close()
if __name__=='__main__':main()
