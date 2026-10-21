<?php
declare(strict_types=1);require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/lab-core.php';require_once __DIR__.'/popularity-store.php';
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();header('Cache-Control: private, no-store');
try{
 $raw=file_get_contents('php://input',false,null,0,4097);$ts=$_SERVER['HTTP_X_NOA_TIMESTAMP']??'';$nonce=$_SERVER['HTTP_X_NOA_NONCE']??'';$sig=$_SERVER['HTTP_X_NOA_SIGNATURE']??'';
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||strlen($raw)>4096||!ctype_digit($ts)||abs(time()-(int)$ts)>180||!preg_match('/^[a-f0-9]{32}$/D',$nonce))lab_json(401,['ok'=>false,'error'=>'service_auth_required']);
 $key=trim((string)file_get_contents(lab_root().'/worker.key'));$signed="NOA-POPULARITY-1\nPOST\n".hash('sha256',$raw)."\n".$ts."\n".$nonce;if(strlen($key)!==64||!hash_equals(hash_hmac('sha256',$signed,$key),$sig))lab_json(401,['ok'=>false,'error'=>'service_auth_required']);
 $path=lab_root().'/popularity-nonce-'.$nonce;$f=@fopen($path,'x');if(!$f)lab_json(409,['ok'=>false,'error'=>'replayed_or_nonce_unavailable']);chmod($path,0600);fwrite($f,$ts);fclose($f);foreach(glob(lab_root().'/popularity-nonce-*')as $p)if(filemtime($p)<time()-600&&!is_link($p))unlink($p);
 set_time_limit(120);$b=json_decode($raw,true,32,JSON_THROW_ON_ERROR);$db=noa_bridge_pdo();$db->exec("SET time_zone='+00:00'");$a=$b['action']??'';
 if($a==='inspect'){
  $tables=$db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);$existing=[];foreach($tables as $t)if(preg_match('/rank|play|popular/i',$t))$existing[]=$t;$state=lab_read();$sync=$state['youtubeSync']??null;
  lab_json(200,['ok'=>true,'existingRelevantTables'=>$existing,'taxonomyInstalled'=>nt_ready($db),'catalogSongs'=>count(ny_songs($db,ny_batch($db))),'youtubeCollection'=>ny_latest($db)['run_id']??null,'youtubeSync'=>$sync?array_intersect_key($sync,array_flip(['id','stage','revision','updatedAt'])):null,'installed'=>np_ready($db)]);
 }
 if($a==='bootstrap'){
  $r=json_decode((string)file_get_contents(lab_root().'/taxonomy-backup-receipt.json'),true,512,JSON_THROW_ON_ERROR);if(($b['verifiedBackupSha256']??'')!==$r['sha256']||time()-$r['at']>7200||empty($b['isolatedRestoreVerified']))throw new DomainException('verified_recent_backup_required');if(!nt_ready($db))throw new DomainException('taxonomy_required');$before=np_protected_sources($db);$created=np_migrate($db,'deployment');if($before!==np_protected_sources($db))throw new RuntimeException('protected_source_changed');lab_json(200,['ok'=>true,'created'=>$created,'policy'=>np_policy($db),'protectedSourcesUnchanged'=>true]);
 }
 if(!np_ready($db))throw new DomainException('ranking_not_installed');
 if($a==='calculate')lab_json(200,['ok'=>true,'result'=>np_calculate($db)]);
 if($a==='verify'){
  $run=$db->query("SELECT summary FROM noa_ranking_runs WHERE status='published' ORDER BY hour_utc DESC LIMIT 1")->fetchColumn();$counts=[];foreach(array_keys(require __DIR__.'/popularity-schema.php')as $t)$counts[$t]=(int)$db->query('SELECT COUNT(*) FROM `'.$t.'`')->fetchColumn();$q=$db->query("SELECT kind,code,COUNT(*) AS n FROM noa_ranking_errors GROUP BY kind,code");lab_json(200,['ok'=>true,'counts'=>$counts,'latest'=>$run?json_decode($run,true):null,'policy'=>np_policy($db),'errors'=>$q->fetchAll(PDO::FETCH_ASSOC),'catalogSongs'=>count(ny_songs($db,ny_batch($db))),'tables'=>(int)$db->query('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()')->fetchColumn()]);
 }
 lab_json(400,['ok'=>false,'error'=>'unknown_fixed_operation']);
}catch(DomainException $e){lab_json(200,['ok'=>false,'error'=>$e->getMessage()]);}catch(Throwable $e){error_log('[noa-popularity-worker] '.get_class($e).':'.$e->getCode());lab_json(503,['ok'=>false,'error'=>'popularity_operation_failed']);}

/** Read-only checks on immutable catalog/manual/rule sources; no locks on music jobs. */
function np_protected_sources(PDO $db):array{
 $tables=array_merge(array_keys(require __DIR__.'/taxonomy-schema.php'),['g5_member']);foreach($db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN)as $t)if(str_starts_with($t,'noa_catalog_'))$tables[]=$t;$out=[];
 foreach($tables as $t){if(!preg_match('/^[a-z0-9_]+$/D',$t))throw new RuntimeException('invalid_table');$rows=[];$q=$db->query('SELECT * FROM `'.$t.'`');while($r=$q->fetch(PDO::FETCH_NUM))$rows[]=hash('sha256',serialize($r));$q->closeCursor();sort($rows,SORT_STRING);$out[$t]=hash('sha256',np_json($rows));}return $out;
}
