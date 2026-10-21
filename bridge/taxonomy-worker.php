<?php
/** Fixed deployment/synchronization operations authenticated by the existing
 * private service key. Not a SQL console and not a browser/admin auth fallback. */
declare(strict_types=1);require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/lab-core.php';require_once __DIR__.'/taxonomy-guard.php';
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
header('Cache-Control: private, no-store');
try{
 $raw=file_get_contents('php://input',false,null,0,16385);$ts=$_SERVER['HTTP_X_NOA_TIMESTAMP']??'';$nonce=$_SERVER['HTTP_X_NOA_NONCE']??'';$sig=$_SERVER['HTTP_X_NOA_SIGNATURE']??'';
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||strlen($raw)>16384||!ctype_digit($ts)||abs(time()-(int)$ts)>180||!preg_match('/^[a-f0-9]{32}$/D',$nonce))lab_json(401,['error'=>'service_auth_required']);
 $key=trim((string)file_get_contents(lab_root().'/worker.key'));$signed="NOA-TAXONOMY-1\nPOST\n".hash('sha256',$raw)."\n".$ts."\n".$nonce;if(strlen($key)!==64||!hash_equals(hash_hmac('sha256',$signed,$key),$sig))lab_json(401,['error'=>'service_auth_required']);
 $path=lab_root().'/taxonomy-nonce-'.$nonce;$f=@fopen($path,'x');if(!$f)lab_json(409,['error'=>'replayed_request']);chmod($path,0600);fwrite($f,$ts);fclose($f);foreach(glob(lab_root().'/taxonomy-nonce-*')as $p)if(filemtime($p)<time()-600&&!is_link($p))unlink($p);
 set_time_limit(120);$b=json_decode($raw,true,512,JSON_THROW_ON_ERROR);$db=noa_bridge_pdo();$action=$b['action']??'';
 if($action==='inspect'){$g=nt_legacy_guard($db);$receiptPath=lab_root().'/taxonomy-backup-receipt.json';$changed=[];if(is_file($receiptPath)){$receipt=json_decode(file_get_contents($receiptPath),true,512,JSON_THROW_ON_ERROR);foreach(array_unique(array_merge(array_keys($g),array_keys($receipt['guard'])))as $table)if(($g[$table]??null)!==($receipt['guard'][$table]??null))$changed[]=$table;}lab_json(200,['ok'=>true,'inventory'=>nt_inventory($db),'legacyGuard'=>$g,'changedSinceBackup'=>$changed]);}
 if($action==='backup'){
  require_once dirname(__DIR__).'/noa-app/database/core.php';$guard=nt_legacy_guard($db);$m=nd_backup(nd_db(),null);$receipt=['sha256'=>$m['sha256'],'id'=>$m['id'],'guard'=>$guard,'at'=>time()];$path=lab_root().'/taxonomy-backup-receipt.json';$tmp=tempnam(lab_root(),'.taxonomy-');chmod($tmp,0600);file_put_contents($tmp,nt_json($receipt));rename($tmp,$path);lab_json(200,['ok'=>true,'backup'=>['id'=>$m['id'],'sha256'=>$m['sha256'],'bytes'=>$m['bytes'],'tables'=>$m['tables']],'inventory'=>nt_inventory($db)]);
 }
 if($action==='bootstrap'){
  $receipt=json_decode((string)file_get_contents(lab_root().'/taxonomy-backup-receipt.json'),true,512,JSON_THROW_ON_ERROR);
  if(($b['verifiedBackupSha256']??'')!==$receipt['sha256']||time()-$receipt['at']>7200||empty($b['isolatedRestoreVerified']))throw new DomainException('verified_recent_backup_required');
  $before=nt_legacy_guard($db);if($before!==$receipt['guard']){$changed=[];foreach(array_unique(array_merge(array_keys($before),array_keys($receipt['guard']))) as $table)if(($before[$table]??null)!==($receipt['guard'][$table]??null))$changed[]=$table;lab_json(200,['ok'=>false,'error'=>'legacy_data_changed_take_new_backup','changedTables'=>$changed]);}
  $migration=nt_migrate($db,'deployment');$sync=nt_sync($db,'deployment');$after=nt_legacy_guard($db);if($before!==$after)throw new RuntimeException('legacy_guard_changed');lab_json(200,['ok'=>true,'migration'=>$migration,'sync'=>$sync,'counts'=>nt_counts($db),'inventory'=>nt_inventory($db),'allPreexistingTablesUnchanged'=>true]);
 }
 if($action==='sync'){lab_json(200,['ok'=>true,'sync'=>nt_sync($db,'service'),'counts'=>nt_counts($db)]);}
 if($action==='verify')lab_json(200,['ok'=>true,'inventory'=>nt_inventory($db),'legacyGuard'=>nt_legacy_guard($db),'status'=>nt_ready($db)?nt_admin_safe_status($db):null]);
 lab_json(400,['error'=>'unknown_fixed_operation']);
}catch(DomainException $e){lab_json(200,['ok'=>false,'error'=>$e->getMessage()]);}catch(Throwable $e){error_log('[noa-taxonomy-service] '.get_class($e).':'.$e->getCode());lab_json(503,['error'=>'taxonomy_service_unavailable']);}
function nt_admin_safe_status(PDO $db):array{return ['counts'=>nt_counts($db),'latest'=>$db->query('SELECT result FROM noa_classification_runs ORDER BY created_at DESC LIMIT 1')->fetchColumn(),'productionRules'=>(int)$db->query('SELECT COUNT(*) FROM noa_production_rules')->fetchColumn(),'productionRevisions'=>(int)$db->query('SELECT COUNT(*) FROM noa_production_rule_revisions')->fetchColumn()];}
