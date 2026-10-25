"""Reuse the existing NOA identity to run a fixed, audited record consolidation.
No credentials, private lyrics, prompts or arbitrary SQL appear in reports.
"""
import hashlib,hmac,json,secrets,stat,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect
from n80_workstate_sync import request as workstate
ROOT='/hosting/noastudio/noa-ai-lab'
def service(key,body):
 raw=json.dumps(body,separators=(',',':')).encode();ts=str(int(time.time()));nonce=secrets.token_hex(16)
 signed='NOA-PACKAGE-1\nPOST\n'+hashlib.sha256(raw).hexdigest()+'\n'+ts+'\n'+nonce
 req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/package-worker.php',data=raw,method='POST',headers={'Content-Type':'application/json','X-NOA-Timestamp':ts,'X-NOA-Nonce':nonce,'X-NOA-Signature':hmac.new(key,signed.encode(),hashlib.sha256).hexdigest()})
 with urllib.request.urlopen(req,timeout=150) as r:value=json.load(r)
 if value.get('ok') is not True:raise RuntimeError('package_operation_failed:'+str(value.get('error')))
 return value
def main():
 transport=connect()
 try:
  with paramiko.SFTPClient.from_transport(transport) as sftp:
   sftp.get_channel().settimeout(30)
   with sftp.open(ROOT+'/worker.key','rb') as f:key=f.read(129).strip()
   if len(key)!=64:raise RuntimeError('invalid_worker_key')
   before=workstate(key,{'action':'read'});plan=service(key,{'action':'inspect'})
   applied=service(key,{'action':'apply','sourceHash':plan['sourceHash']});after=service(key,{'action':'inspect'})
   if after['changed']!=0:raise RuntimeError('record_consolidation_not_idempotent')
   manifest=[]
   for name in sftp.listdir(ROOT+'/packages/records'):
    if not name.endswith('.json'):continue
    path=ROOT+'/packages/records/'+name;info=sftp.lstat(path)
    if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode)!=0o600:raise RuntimeError('unsafe_record_file')
    with sftp.open(path,'rb') as f:raw=f.read()
    v=json.loads(raw)
    if name!=hashlib.sha256(v['key'].encode()).hexdigest()+'.json' or v['record'].get('packageSchema')!=1:raise RuntimeError('record_file_invalid')
    manifest.append({'name':name,'sha256':hashlib.sha256(raw).hexdigest(),'revision':v['revision'],'bytes':len(raw)})
   if len(manifest)!=applied['files']:raise RuntimeError('record_file_count_mismatch')
   receipt={'plan':plan,'applied':applied,'postflight':after,'privateFileReadback':{'files':len(manifest),'manifestSha256':hashlib.sha256(json.dumps(sorted(manifest,key=lambda x:x['name']),separators=(',',':')).encode()).hexdigest(),'allMode0600':True},'n80':{'readOnly':True,'revisionBefore':before.get('state',{}).get('revision'),'summaryBefore':before.get('summary')}}
 finally:transport.close()
 out=Path('inline-edit-proof/live');out.mkdir(parents=True,exist_ok=True);(out/'unified-records.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
 print('NOA_UNIFIED_RECORDS_VERIFIED',json.dumps(receipt,ensure_ascii=False))
if __name__=='__main__':main()
