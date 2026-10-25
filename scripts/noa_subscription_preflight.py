"""Read-only native GnuBoard compatibility audit; temporary signed helper is removed."""
import hashlib,json,secrets,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT

def main():
 token=secrets.token_hex(32);nonce=secrets.token_hex(8);remote=ROOT+'/noa-bridge/subscription-preflight-'+nonce+'.php';t=connect();s=paramiko.SFTPClient.from_transport(t);code='''<?php
ini_set('display_errors','0');if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>EXPIRY||!hash_equals('TOKEN',hash('sha256',(string)($_SERVER['HTTP_X_NOA_QA']??'')))){http_response_code(404);exit;}
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';header('Content-Type: application/json');header('Cache-Control: no-store');
try{$db=noa_bridge_pdo();$tables=[];foreach(['member_table','point_table']as $k){$name=$g5[$k];$q=$db->prepare('SELECT ENGINE,TABLE_ROWS,DATA_LENGTH,INDEX_LENGTH FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?');$q->execute([$name]);$tables[$k]=$q->fetch(PDO::FETCH_ASSOC);}$q=$db->query("SELECT COUNT(*) FROM noa_documents WHERE doc_key='subscription:policy'");echo json_encode(['ok'=>true,'tables'=>$tables,'nativePointsEnabled'=>!empty($config['cf_use_point']),'nativeConnection'=>($g5['connect_db']??null) instanceof mysqli,'nativeInsertPoint'=>function_exists('insert_point'),'nativePointSum'=>function_exists('get_point_sum'),'existingPolicy'=>(int)$q->fetchColumn()]);}catch(Throwable $e){echo json_encode(['ok'=>false,'error'=>get_class($e)]);}
'''.replace('EXPIRY',str(int(time.time())+300)).replace('TOKEN',hashlib.sha256(token.encode()).hexdigest()).encode()
 installed=False
 try:
  try:s.lstat(remote)
  except FileNotFoundError:pass
  else:raise RuntimeError('existing_helper_preserved')
  with s.open(remote,'wx')as f:f.write(code)
  installed=True;s.chmod(remote,0o644)
  with s.open(remote,'rb')as f:
   if f.read()!=code:raise RuntimeError('helper_readback_mismatch')
  req=urllib.request.Request('https://noastudio.ai.kr'+remote.removeprefix(ROOT),data=b'{}',headers={'Content-Type':'application/json','X-NOA-QA':token})
  with urllib.request.urlopen(req,timeout=30)as r:data=json.loads(r.read())
  if not data.get('ok'):raise RuntimeError('native_compatibility_unavailable')
  Path('subscription-proof').mkdir(exist_ok=True);Path('subscription-proof/preflight.json').write_text(json.dumps(data,indent=2));print('SUBSCRIPTION_NATIVE_PREFLIGHT',json.dumps(data))
 finally:
  if installed:
   with s.open(remote,'rb')as f:
    if f.read()!=code:raise RuntimeError('changed_helper_preserved')
   s.remove(remote)
  s.close();t.close()
if __name__=='__main__':main()
