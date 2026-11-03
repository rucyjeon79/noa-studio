"""Scoped native store integration; immutable source IDs; no customer order or balance mutation."""
import sys,time,secrets,hashlib,json,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
FILES={'deploy/noa-youngcart-premium.css':'noa-youngcart-premium.css','deploy/noa-youngcart-premium.js':'noa-youngcart-premium.js','bridge/youngcart-core.php':'noa-bridge/youngcart-core.php','deploy/noa-youngcart.php':'noa-youngcart.php','deploy/noa-youngcart.js':'noa-youngcart.js','deploy/noa-youngcart-relay.js':'noa-youngcart-relay.js','deploy/noa-youngcart.extend.php':'extend/zz.noa-youngcart.php'}
PHP=r'''<?php
ini_set('display_errors','0');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>YC_EXPIRY||!hash_equals('YC_TOKEN',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
require dirname(__DIR__).'/common.php';require G5_PATH.'/noa-bridge/youngcart-core.php';header('Content-Type: application/json');
try{if(!defined('G5_USE_SHOP')||!G5_USE_SHOP)throw new RuntimeException('shop_not_installed');if(empty($default['de_card_test'])||$default['de_pg_service']!=='kcp')throw new RuntimeException('preserve_operating_payment_configuration');$counts=[];foreach(['member_table','board_table']as $k){$r=sql_fetch('SELECT COUNT(*) AS n FROM `'.$g5[$k].'`');$counts[$k]=(int)$r['n'];}$result=ny_sync_catalog();ns_q('UPDATE '.ns_table('g5_shop_default_table')." SET de_card_use=1,de_card_test=1,de_pg_service='kcp',de_settle_min_point=0,de_settle_max_point=1000000,de_settle_point_unit=1");foreach($counts as $k=>$n){$r=sql_fetch('SELECT COUNT(*) AS n FROM `'.$g5[$k].'`');if((int)$r['n']!==$n)throw new RuntimeException('existing_data_count_changed');}echo json_encode(['ok'=>true,'products'=>$result,'mode'=>'test','preserved'=>$counts]);}catch(Throwable $e){echo json_encode(['ok'=>false,'error'=>$e->getMessage(),'dbCode'=>mysqli_errno($g5['connect_db']),'dbMessage'=>mb_substr(mysqli_error($g5['connect_db']),0,240)]);}
'''
def main():
 t=connect();token=secrets.token_hex(32);name='yc-unify-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name;uploaded=False;before={}
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   def read(p):
    with s.open(ROOT+'/'+p,'rb') as f:return f.read()
   def put(p,data):
    temp=ROOT+'/'+p+'.ny-'+secrets.token_hex(8)
    with s.open(temp,'wx') as f:f.write(data)
    s.chmod(temp,0o644);s.posix_rename(temp,ROOT+'/'+p)
   # Source-only files are installed before hooks or links are exposed.
   for local,p in FILES.items():
    try:before[p]=read(p)
    except FileNotFoundError:before[p]=None
    put(p,Path(local).read_bytes())
   code=PHP.replace('YC_EXPIRY',str(int(time.time())+600)).replace('YC_TOKEN',hashlib.sha256(token.encode()).hexdigest()).encode()
   with s.open(remote,'wx') as f:f.write(code)
   uploaded=True
   req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=b'{}',headers={'Content-Type':'application/json','X-NOA-Control':token})
   with urllib.request.urlopen(req,timeout=60) as r:data=json.load(r)
   print('YOUNGCART_UNIFY_RESULT',json.dumps(data,ensure_ascii=False))
   if not data['ok']:raise RuntimeError('catalog_sync_failed')
   for p in ['noa-points.php','noa-vip.php']:
    current=read(p);tag=b'<script src="/noa-youngcart.js" defer></script>'
    if tag not in current:
     if b'</head>' not in current:raise RuntimeError('page_contract_changed')
     before[p]=current;put(p,current.replace(b'</head>',tag+b'</head>',1))
   # Change only the three known native handoff functions; retain concurrent UI edits.
   p='noa-ecosystem.js';raw=read(p).decode();source=Path('deploy/noa-ecosystem.js').read_text();lines=raw.splitlines();changed=0
   for prefix in ['function purchaseLink(p)','async function add(p)','function cart()']:
    new=next(x for x in source.splitlines() if x.startswith(prefix));matches=[i for i,x in enumerate(lines) if x.startswith(prefix)]
    if len(matches)!=1:raise RuntimeError('shop_function_contract_changed')
    i=matches[0];lines[i]=new;changed+=1
   before[p]=raw.encode();put(p,('\n'.join(lines)+'\n').encode())
   print('YOUNGCART_UNIFIED_CATALOG_NATIVE_CART_AND_ORDER_HANDOFF_DEPLOYED')
 except:
  with paramiko.SFTPClient.from_transport(t) as s:
   for p,data in before.items():
    # Retain validated integration/fulfillment code after any partial catalog creation.
    if p in FILES.values():continue
    if data is not None:
     with s.open(ROOT+'/'+p,'wb') as f:f.write(data)
    else:
     try:s.remove(ROOT+'/'+p)
     except FileNotFoundError:pass
  raise
 finally:
  if uploaded:
   with paramiko.SFTPClient.from_transport(t) as s:s.remove(remote)
  t.close()
if __name__=='__main__':main()
