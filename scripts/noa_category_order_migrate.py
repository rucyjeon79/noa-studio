"""Copy the exact retained legacy order to SQL once; no song, member or media updates."""
import hashlib,hmac,json,os,secrets,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
from n80_live_observer import NoRedirect
BASE='https://noastudio.ai.kr'
def sha(v):return hashlib.sha256(v).hexdigest()
def get_order():
 with urllib.request.urlopen(BASE+'/noa-category-order.php?audit='+secrets.token_hex(4),timeout=30)as r:return json.load(r)
def main():
 before=get_order();t=connect();helper='noa-bridge/order-migration-'+secrets.token_hex(8)+'.php';code=Path('scripts/noa_category_order_migrate.php').read_text().replace('__EXPIRY__',str(int(time.time())+600)).encode();installed=False
 try:
  with paramiko.SFTPClient.from_transport(t)as s:
   s.get_channel().settimeout(45)
   def read(p,limit=2097153):
    with s.open(p,'rb')as f:return f.read(limit)
   with s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb')as f:key=f.read(129).strip()
   if len(key)!=64:raise RuntimeError('worker_key_invalid')
   try:legacy=read('/hosting/noastudio/noa-ai-lab/category-order.json')
   except FileNotFoundError:legacy=b'{}'
   if len(legacy)>2097152:raise RuntimeError('legacy_too_large')
   with s.open(ROOT+'/'+helper,'wx')as f:f.write(code)
   installed=True;s.chmod(ROOT+'/'+helper,0o644)
   try:
    if read(ROOT+'/'+helper)!=code:raise RuntimeError('helper_checksum')
    raw=json.dumps({'action':'migrate','legacySha256':sha(legacy)},separators=(',',':')).encode();ts=str(int(time.time()));nonce=secrets.token_hex(16)
    sig=hmac.new(key,('NOA-ORDER-MIGRATE-1\n'+sha(raw)+'\n'+ts+'\n'+nonce).encode(),hashlib.sha256).hexdigest()
    req=urllib.request.Request(BASE+'/'+helper,data=raw,headers={'Content-Type':'application/json','X-N80-Timestamp':ts,'X-N80-Nonce':nonce,'X-N80-Signature':sig})
    with urllib.request.build_opener(NoRedirect()).open(req,timeout=45)as r:body=r.read(65537);signature=r.headers.get('X-N80-Signature','')
    if len(body)>65536 or not hmac.compare_digest(signature,hmac.new(key,('NOA-ORDER-RESPONSE-1\n'+nonce+'\n'+sha(body)).encode(),hashlib.sha256).hexdigest()):raise RuntimeError('response_signature')
    result=json.loads(body);assert result['ok']and result['nonce']==nonce;result=result['result'];assert result['source']=='mysql'and result['legacyUnchanged']and result['unrelatedDocumentsUnchanged']and result['replayUnchanged']
   finally:
    if installed:
     if read(ROOT+'/'+helper)!=code:raise RuntimeError('changed_helper_preserved')
     s.remove(ROOT+'/'+helper)
 finally:t.close()
 after=get_order()
 for group in ['story','cover','playlists']:assert before[group]==after[group], 'public_order_changed'
 assert after['revision']==result['revision']
 result.update({'commit':os.environ['GITHUB_SHA'],'publicReadbackUnchanged':True,'helperRemoved':True})
 out=Path('ainoa-proof');out.mkdir(exist_ok=True);(out/'category-order-migration.json').write_text(json.dumps(result,indent=2));print('CATEGORY_ORDER_MYSQL_VERIFIED',json.dumps(result))
if __name__=='__main__':main()
