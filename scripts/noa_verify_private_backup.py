"""Verify a known private production backup in an isolated MySQL service only.
Never logs SQL, rows, credentials or dump bytes; removes every temporary file.
"""
import base64,hashlib,json,os,re,subprocess,tempfile,time,urllib.request
from pathlib import Path
import paramiko
EXPECTED='6dac39d8fe1b14a53a6ba198d9374edb0d8b6c6b8b785dfc3a64699fecc31a3c'
PRIVATE='/hosting/noastudio/noa-db-private'
PHP=r'''<?php
$input=json_decode(file_get_contents($argv[1]),true,512,JSON_THROW_ON_ERROR);
$db=new PDO('mysql:host=127.0.0.1;dbname=noa_restore_verification;charset=utf8mb4','root','noa-isolated-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false,PDO::MYSQL_ATTR_USE_BUFFERED_QUERY=>false]);
$db->exec("SET time_zone='+00:00'");$result=[];
foreach($input as $table=>$columns){
 if(!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/D',$table))throw new RuntimeException('identifier');
 $fields=$columns?implode(',',array_map(fn($c)=>'`'.str_replace('`','``',$c).'`',$columns)):'*';
 $q=$db->query('SELECT '.$fields.' FROM `'.$table.'`');$sum=array_fill(0,8,0);$rows=0;
 while($r=$q->fetch(PDO::FETCH_NUM)){$h=hash_init('sha256');foreach($r as $v){if($v===null)hash_update($h,'N;');else{$v=(string)$v;hash_update($h,'V'.strlen($v).':'.$v.';');}}$digest=unpack('N8',hash_final($h,true));foreach($digest as $i=>$v)$sum[$i-1]=($sum[$i-1]+$v)&0xffffffff;$rows++;}
 $q->closeCursor();$result[$table]=['rows'=>$rows,'sum'=>$sum];
}
echo json_encode($result,JSON_THROW_ON_ERROR);
'''
def main():
 # Cancel only our previous stalled verification, preserving every deployment/other job.
 old='39530927135';api='https://api.github.com/repos/rucyjeon79/noa-studio/actions/runs/'+old
 headers={'Authorization':'Bearer '+os.environ['GITHUB_TOKEN'],'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}
 with urllib.request.urlopen(urllib.request.Request(api,headers=headers),timeout=20) as r:prior=json.load(r)
 assert prior['head_sha']=='d36ed5e5a0c8bac0444b822f91bc398481488152' and prior['path']=='.github/workflows/noa-database-backup-proof.yml'
 if prior['status']!='completed':
  with urllib.request.urlopen(urllib.request.Request(api+'/cancel',data=b'{}',headers=headers,method='POST'),timeout=20) as r:assert r.status==202
  print('Previous verification only: cancellation requested',flush=True)
 t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
 with tempfile.TemporaryDirectory(prefix='noa-private-restore-') as tmp:
  os.chmod(tmp,0o700);dump=Path(tmp)/'backup.sql'
  try:
   t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
   fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
   if fp!='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU':raise RuntimeError('host_key_mismatch')
   t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD']);s=paramiko.SFTPClient.from_transport(t,window_size=8388608);s.get_channel().settimeout(30)
   manifest=None
   for name in s.listdir(PRIVATE):
    if not re.fullmatch('[a-f0-9]{32}\\.json',name):continue
    with s.open(PRIVATE+'/'+name,'rb') as f:m=json.loads(f.read(65536))
    if m.get('sha256')==EXPECTED:manifest=m;break
   if not manifest:raise RuntimeError('known_backup_not_found')
   if not 0<manifest['bytes']<=268435456:raise RuntimeError('size_limit')
   start=time.monotonic();last=[0]
   def progress(done,total):
    if time.monotonic()-start>180:raise TimeoutError('private_transfer_deadline')
    if done-last[0]>=16777216 or done==total:print('Private transfer progress '+str(done)+'/'+str(total),flush=True);last[0]=done
   print('Private transfer started: '+str(manifest['bytes'])+' bytes',flush=True)
   s.get(PRIVATE+'/'+manifest['id']+'.sql',str(dump),callback=progress,max_concurrent_prefetch_requests=64);os.chmod(dump,0o600)
   print('Private transfer finished',flush=True)
   if dump.stat().st_size!=manifest['bytes'] or hashlib.file_digest(dump.open('rb'),'sha256').hexdigest()!=EXPECTED:raise RuntimeError('integrity_mismatch')
  finally:t.close()
  expected={name:{'rows':0,'sum':[0]*8} for name in manifest['tables']};columns={name:[] for name in expected};schemas={}
  pattern=re.compile(rb"^INSERT INTO `([A-Za-z_][A-Za-z0-9_]*)` \((.*?)\) VALUES \((.*)\);\n$")
  value=re.compile(rb"CONVERT\(X'([0-9a-f]*)' USING utf8mb4\)|X'([0-9a-f]*)'|(NULL)")
  with dump.open('rb') as f:
   ddl=[];ddl_table=None
   for line in f:
    if line.startswith(b'CREATE TABLE `'):
     ddl=[line];ddl_table=line.split(b'`')[1].decode();continue
    if ddl_table:
     ddl.append(line)
     if line.rstrip().endswith(b';'):
      schemas[ddl_table]=b''.join(ddl).decode().rstrip()[:-1];ddl_table=None;ddl=[]
     continue
    m=pattern.match(line)
    if not m:continue
    name=m[1].decode();cols=[x.decode().replace('``','`') for x in re.findall(rb'`((?:``|[^`])*)`',m[2])];columns[name]=cols
    h=hashlib.sha256();matches=list(value.finditer(m[3]));assert len(matches)==len(cols)
    for x in matches:
     if x[3]:h.update(b'N;')
     else:
      raw=bytes.fromhex((x[1] if x[1] is not None else x[2]).decode());h.update(b'V'+str(len(raw)).encode()+b':'+raw+b';')
    expected[name]['rows']+=1;d=h.digest()
    for i in range(8):expected[name]['sum'][i]=(expected[name]['sum'][i]+int.from_bytes(d[i*4:i*4+4],'big'))&0xffffffff
  assert set(schemas)==set(expected),'schema coverage mismatch'
  assert {t:v['rows'] for t,v in expected.items()}==manifest['tables'],'manifest row mismatch'
  env={**os.environ,'MYSQL_PWD':'noa-isolated-only'}
  print('Isolated restore started',flush=True)
  restore_input=Path(tmp)/'restore-input.sql'
  with restore_input.open('wb') as out,dump.open('rb') as original:
   out.write(b'SET autocommit=0;\n')
   while chunk:=original.read(1048576):out.write(chunk)
   out.write(b'\nCOMMIT;\n')
  os.chmod(restore_input,0o600)
  with restore_input.open('rb') as f:
   r=subprocess.run(['mysql','--host=127.0.0.1','--user=root','--database=noa_restore_verification','--binary-mode','--default-character-set=utf8mb4'],stdin=f,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,env=env,timeout=240)
   if r.returncode:raise RuntimeError('isolated_restore_failed_code_'+str(r.returncode))
  print('Isolated restore finished; verifying all row content',flush=True)
  meta=Path(tmp)/'columns.json';meta.write_text(json.dumps(columns));os.chmod(meta,0o600)
  script=Path(tmp)/'compare.php';script.write_text(PHP);os.chmod(script,0o600)
  result=subprocess.run(['php',str(script),str(meta)],capture_output=True,timeout=240)
  if result.returncode:raise RuntimeError('isolated_verification_failed')
  actual=json.loads(result.stdout);assert actual==expected,'restored row content checksum mismatch'
  # Verify original SHOW CREATE definitions against the isolated restored definitions.
  schema_script=Path(tmp)/'schema.php'
  schema_script.write_text("<?php $d=new PDO('mysql:host=127.0.0.1;dbname=noa_restore_verification;charset=utf8mb4','root','noa-isolated-only');$out=[];foreach(json_decode(file_get_contents($argv[1]),true) as $t=>$c)$out[$t]=$d->query('SHOW CREATE TABLE `'.$t.'`')->fetch(PDO::FETCH_NUM)[1];echo json_encode($out,JSON_THROW_ON_ERROR);")
  r=subprocess.run(['php',str(schema_script),str(meta)],capture_output=True,timeout=60);assert r.returncode==0
  restored_schemas=json.loads(r.stdout);assert restored_schemas==schemas,'restored schema mismatch'
  print('PRIVATE_PRODUCTION_RESTORE_VERIFIED '+json.dumps({'sha256':EXPECTED,'bytes':manifest['bytes'],'tables':len(expected),'rows':sum(v['rows']for v in expected.values()),'originalSchemasEqual':True,'allTableRowContentChecksumsEqual':True,'productionDatabaseModified':False,'privateDumpUploadedAsArtifact':False}))
if __name__=='__main__':main()
