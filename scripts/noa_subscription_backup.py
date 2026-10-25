"""Read-only encrypted member/point backup export. No private encryption key leaves the workspace."""
import hashlib,json,secrets,time,urllib.request
from pathlib import Path
import paramiko
from cryptography.hazmat.primitives import serialization,hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from noa_full_inventory import connect,ROOT

def main():
 token=secrets.token_hex(32);nonce=secrets.token_hex(8);remote=ROOT+'/noa-bridge/point-backup-'+nonce+'.php';t=connect();s=paramiko.SFTPClient.from_transport(t);code='''<?php
ini_set('display_errors','0');if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>EXPIRY||!hash_equals('TOKEN',hash('sha256',(string)($_SERVER['HTTP_X_NOA_QA']??'')))){http_response_code(404);exit;}
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';header('Content-Type: application/json');header('Cache-Control: no-store');
try{$db=noa_bridge_pdo();$out=['format'=>'noa-point-engine-preimage-v1','tables'=>[]];foreach(['member_table','point_table']as $kind){$table=$g5[$kind];if(!preg_match('/^[a-zA-Z0-9_]+$/D',$table))throw new RuntimeException('invalid_table');$rows=$db->query('SELECT * FROM `'.$table.'` ORDER BY 1')->fetchAll(PDO::FETCH_ASSOC);$ddl=$db->query('SHOW CREATE TABLE `'.$table.'`')->fetch(PDO::FETCH_NUM)[1];$q=$db->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?');$q->execute([$table]);$out['tables'][$kind]=['name'=>$table,'engine'=>$q->fetchColumn(),'ddl'=>$ddl,'rows'=>$rows];}echo json_encode($out,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);}catch(Throwable $e){echo json_encode(['error'=>'backup_export_unavailable']);}
'''.replace('EXPIRY',str(int(time.time())+300)).replace('TOKEN',hashlib.sha256(token.encode()).hexdigest()).encode();installed=False
 try:
  try:s.lstat(remote)
  except FileNotFoundError:pass
  else:raise RuntimeError('existing_helper_preserved')
  with s.open(remote,'wx')as f:f.write(code)
  installed=True;s.chmod(remote,0o644)
  with s.open(remote,'rb')as f:
   if f.read()!=code:raise RuntimeError('helper_readback_mismatch')
  request=urllib.request.Request('https://noastudio.ai.kr'+remote.removeprefix(ROOT),data=b'{}',headers={'Content-Type':'application/json','X-NOA-QA':token})
  with urllib.request.urlopen(request,timeout=30)as response:payload=response.read(10485761)
  if len(payload)>10485760:raise RuntimeError('bounded_export_exceeded')
  parsed=json.loads(payload)
  if parsed.get('format')!='noa-point-engine-preimage-v1':raise RuntimeError('backup_export_failed')
  public=Path('scripts/noa_subscription_backup_public.pem').read_bytes();key=secrets.token_bytes(32);iv=secrets.token_bytes(12);context=b'NOA-POINT-ENGINE-BACKUP-1';cipher=AESGCM(key).encrypt(iv,payload,context);wrapped=serialization.load_pem_public_key(public).encrypt(key,padding.OAEP(mgf=padding.MGF1(hashes.SHA256()),algorithm=hashes.SHA256(),label=context))
  import base64
  envelope=json.dumps({'format':'noa-encrypted-backup-v1','algorithm':'RSA-OAEP-SHA256/AES-256-GCM','wrappedKey':base64.b64encode(wrapped).decode(),'nonce':base64.b64encode(iv).decode(),'ciphertext':base64.b64encode(cipher).decode()},separators=(',',':')).encode()
  out=Path('subscription-backup');out.mkdir(exist_ok=True);(out/'NOA-member-points-preimage.enc').write_bytes(envelope)
  manifest={'format':'noa-encrypted-backup-v1','archiveSha256':hashlib.sha256(envelope).hexdigest(),'payloadSha256':hashlib.sha256(payload).hexdigest(),'publicKeySha256':hashlib.sha256(public).hexdigest(),'tables':{k:{'rows':len(v['rows']),'engine':v['engine'],'schemaSha256':hashlib.sha256(v['ddl'].encode()).hexdigest()}for k,v in parsed['tables'].items()},'databaseWrites':0,'privateKeyExported':False}
  (out/'manifest.json').write_text(json.dumps(manifest,indent=2));print('ENCRYPTED_POINT_BACKUP_EXPORTED',json.dumps(manifest))
 finally:
  if installed:
   with s.open(remote,'rb')as f:
    if f.read()!=code:raise RuntimeError('changed_helper_preserved')
   s.remove(remote)
  s.close();t.close()
if __name__=='__main__':main()
