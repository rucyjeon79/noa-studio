"""Add native Youngcart tables/configuration without running the destructive full installer."""
import hashlib,json,re,secrets,time,urllib.request,sys,stat
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
PHP=r'''<?php
ini_set('display_errors','0');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>YC_EXPIRY||!hash_equals('YC_TOKEN',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
require dirname(__DIR__).'/common.php';
header('Content-Type: application/json');
try{
 if(defined('G5_USE_SHOP')&&G5_USE_SHOP)throw new RuntimeException('already_enabled');
 $schema=file_get_contents(G5_PATH.'/install/gnuboard5shop.sql');
 if(!hash_equals('YC_SCHEMA',hash('sha256',$schema)))throw new RuntimeException('schema_changed');
 $schema=preg_replace('/^--.*$/m','',$schema);$queries=[];$tables=[];
 foreach(explode(';',$schema) as $q){$q=trim($q);if($q==='')continue;
  if(!preg_match('/^CREATE TABLE IF NOT EXISTS `(g5_shop_[a-z_]+)`\\s*\\(/',$q,$m))throw new RuntimeException('unexpected_schema_statement');
  $tables[]=$m[1];$queries[]=$q;
 }
 if(count($tables)!==24||count(array_unique($tables))!==24)throw new RuntimeException('unexpected_table_set');
 foreach($tables as $table){$r=sql_fetch("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='".$table."'");if((int)$r['n'])throw new RuntimeException('existing_shop_tables_preserved');}
 $counts=[];foreach(['member_table','board_table'] as $k){$r=sql_fetch('SELECT COUNT(*) AS n FROM `'.$g5[$k].'`');$counts[$k]=(int)$r['n'];}
 $input=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);$defaults=$input['defaults']??[];
 if(!is_array($defaults)||count($defaults)<100)throw new RuntimeException('missing_native_defaults');
 $sets=[];foreach($defaults as $k=>$v){if(!preg_match('/^de_[a-z0-9_]+$/D',$k)||!is_string($v))throw new RuntimeException('invalid_default');$sets[]='`'.$k."`='".sql_real_escape_string($v)."'";}
 if(($defaults['de_card_test']??'')!=='1'||($defaults['de_pg_service']??'')!=='kcp'||($defaults['de_bank_use']??'')!=='0')throw new RuntimeException('test_mode_required');
 $lock=sql_fetch("SELECT GET_LOCK('noa_youngcart_install',1) AS locked");if((int)$lock['locked']!==1)throw new RuntimeException('installation_locked');
 foreach($queries as $q)if(!sql_query($q,false))throw new RuntimeException('table_create_failed');
 if(!sql_query('INSERT INTO `g5_shop_default` SET '.implode(',',$sets),false))throw new RuntimeException('defaults_insert_failed');
 foreach($counts as $k=>$n){$r=sql_fetch('SELECT COUNT(*) AS n FROM `'.$g5[$k].'`');if((int)$r['n']!==$n)throw new RuntimeException('existing_data_count_changed');}
 echo json_encode(['ok'=>true,'tables'=>count($tables),'preservedCounts'=>$counts,'paymentMode'=>'test']);
}catch(Throwable $e){http_response_code(409);echo json_encode(['ok'=>false,'error'=>$e->getMessage()]);}
'''
def main():
 token=secrets.token_hex(32);name='yc-install-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name
 t=connect();uploaded=False
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   def read(p):
    with s.open(ROOT+'/'+p,'rb') as f:return f.read()
   cfg=read('data/dbconfig.php');schema=read('install/gnuboard5shop.sql');native=read('install/install_db.php').decode()
   if b'G5_USE_SHOP' in cfg or b'G5_SHOP_TABLE_PREFIX' in cfg:raise RuntimeError('existing_shop_configuration_preserved')
   required=['shop/cart.php','shop/orderform.php','shop/orderformupdate.php','shop/kcp/orderform.1.php','adm/admin.menu400.shop_1of2.php','adm/shop_admin/configform.php','lib/shop.lib.php']
   for p in required:s.stat(ROOT+'/'+p)
   match=re.search(r'\$sql = " insert into `\{\$g5_shop_prefix\}default`(.*?)";',native,re.S)
   if not match:raise RuntimeError('native_defaults_not_found')
   vals=dict(re.findall(r"(de_[a-z0-9_]+)\s*=\s*'([^']*)'",match.group(1)))
   sizes={k:v for k,v in re.findall(r'\$(\w*(?:width|height)) = (\d+);',native)}
   for k,v in vals.items():
    for var,num in sizes.items():v=v.replace('$'+var,num)
    if '$' in v:raise RuntimeError('unresolved_native_default')
    vals[k]=v.replace('\\n','\n')
   for k in list(vals):
    if k.startswith('de_admin_'):vals[k]=''
   vals.update(de_admin_company_name='제이알',de_admin_company_owner='전서진',de_admin_info_name='전서진',de_bank_use='0',de_bank_account='',de_card_test='1',de_pg_service='kcp')
   mappings=dict(re.findall(r"\\\$g5\['(g5_shop_[a-z_]+)'\] = G5_SHOP_TABLE_PREFIX\.'([a-z_]+)'",native))
   if len(mappings)!=24:raise RuntimeError('native_mapping_count')
   suffix="\n// NOA: additive Youngcart installation, existing database connection preserved.\ndefine('G5_USE_SHOP', true);\ndefine('G5_SHOP_TABLE_PREFIX', 'g5_shop_');\n"+''.join("$g5['%s'] = G5_SHOP_TABLE_PREFIX.'%s';\n"%(k,v) for k,v in mappings.items())
   newcfg=cfg.rstrip()
   if newcfg.endswith(b'?>'):newcfg=newcfg[:-2]
   newcfg+=suffix.encode()
   code=PHP.replace('YC_EXPIRY',str(int(time.time())+600)).replace('YC_TOKEN',hashlib.sha256(token.encode()).hexdigest()).replace('YC_SCHEMA',hashlib.sha256(schema).hexdigest()).encode()
   # Every theme shim is a copy of the installed native basic shop theme; never overwrite a file.
   def copy_missing(src,dst):
    try:s.stat(ROOT+'/'+dst)
    except FileNotFoundError:s.mkdir(ROOT+'/'+dst,0o755)
    for item in s.listdir_attr(ROOT+'/'+src):
     a=src+'/'+item.filename;b=dst+'/'+item.filename
     if stat.S_ISDIR(item.st_mode):copy_missing(a,b)
     elif stat.S_ISREG(item.st_mode):
      try:s.stat(ROOT+'/'+b)
      except FileNotFoundError:
       with s.open(ROOT+'/'+b,'wx') as f:f.write(read(a))
   for src,dst in [('theme/basic/shop','theme/noa_studio/shop'),('theme/basic/mobile/shop','theme/noa_studio/mobile/shop')]:
    s.stat(ROOT+'/'+src)
   # Stage configuration under private data path; it is not active until the native schema succeeds.
   staged='data/yc-config-'+secrets.token_hex(12)+'.php'
   with s.open(ROOT+'/'+staged,'wx') as f:f.write(newcfg)
   s.chmod(ROOT+'/'+staged,0o600)
   try:
    with s.open(remote,'wx') as f:f.write(code)
    uploaded=True;s.chmod(remote,0o644)
    req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=json.dumps({'defaults':vals}).encode(),headers={'Content-Type':'application/json','X-NOA-Control':token})
    try:
     with urllib.request.urlopen(req,timeout=60) as r:result=json.load(r)
    except urllib.error.HTTPError as e:
     print('INSTALL_RESPONSE',e.read().decode()[:1000]);raise
    if not result.get('ok'):raise RuntimeError('installation_not_confirmed')
    for d in ['banner','common','event','item']:
     try:s.stat(ROOT+'/data/'+d)
     except FileNotFoundError:s.mkdir(ROOT+'/data/'+d,0o755)
    for src,dst in [('theme/basic/shop','theme/noa_studio/shop'),('theme/basic/mobile/shop','theme/noa_studio/mobile/shop')]:copy_missing(src,dst)
    if read('data/dbconfig.php')!=cfg:raise RuntimeError('configuration_changed_during_install')
    s.chmod(ROOT+'/'+staged,0o644);s.posix_rename(ROOT+'/'+staged,ROOT+'/data/dbconfig.php')
    assert read('data/dbconfig.php')==newcfg
    print('YOUNGCART_INSTALLED',json.dumps(result))
   finally:
    if uploaded:s.remove(remote)
    try:s.remove(ROOT+'/'+staged)
    except FileNotFoundError:pass
 finally:t.close()
if __name__=='__main__':main()
