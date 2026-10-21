<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}

function nr_schema(PDO $db):void{
 static $ready=[];$key=spl_object_id($db);if(isset($ready[$key]))return;
 $db->exec("CREATE TABLE IF NOT EXISTS noa_jukebox_runtime (id INT PRIMARY KEY,owner CHAR(32) NULL,run_id VARCHAR(32) NULL,source_commit CHAR(40) NULL,state VARCHAR(32) NOT NULL DEFAULT 'unknown',lease_until DATETIME NULL,last_started DATETIME NULL,last_seen DATETIME NULL,last_success DATETIME NULL,last_finished DATETIME NULL,watchdog_seen DATETIME NULL,last_audit DATETIME NULL,audit_cursor BIGINT NOT NULL DEFAULT 0,upload_cursor BIGINT NOT NULL DEFAULT 0) ENGINE=InnoDB");
 $db->exec('INSERT IGNORE INTO noa_jukebox_runtime(id) VALUES(1)');
 $db->exec("CREATE TABLE IF NOT EXISTS noa_jukebox_incidents (id BIGINT AUTO_INCREMENT PRIMARY KEY,signature CHAR(64) NOT NULL UNIQUE,code VARCHAR(96) NOT NULL,stage VARCHAR(32) NOT NULL,http_status INT NOT NULL DEFAULT 0,upload_id CHAR(32) NULL,job_id BIGINT NULL,response_format VARCHAR(16) NULL,request_id CHAR(16) NULL,occurrences INT NOT NULL DEFAULT 1,first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,resolved_at DATETIME NULL,KEY(last_seen)) ENGINE=InnoDB");
 $db->exec("CREATE TABLE IF NOT EXISTS noa_jukebox_worker_observations (run_id VARCHAR(32) PRIMARY KEY,state VARCHAR(16) NOT NULL,checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
 $db->exec("CREATE TABLE IF NOT EXISTS noa_jukebox_faults (id BIGINT AUTO_INCREMENT PRIMARY KEY,session_hash CHAR(64) NOT NULL,song_key VARCHAR(191) NOT NULL,scenario VARCHAR(32) NOT NULL,remaining INT NOT NULL,expires_at DATETIME NOT NULL,KEY(session_hash,expires_at)) ENGINE=InnoDB");
 if(!$db->query("SHOW COLUMNS FROM noa_jukebox_audio_jobs LIKE 'worker_run_id'")->fetch())$db->exec('ALTER TABLE noa_jukebox_audio_jobs ADD COLUMN worker_run_id VARCHAR(32) NULL');
 if(!$db->query("SHOW COLUMNS FROM noa_jukebox_runtime LIKE 'upload_cursor'")->fetch())$db->exec('ALTER TABLE noa_jukebox_runtime ADD COLUMN upload_cursor BIGINT NOT NULL DEFAULT 0');
 $ready[$key]=true;
}
function nr_incident(PDO $db,string $code,string $stage,?string $uploadId=null,?int $jobId=null,array $detail=[]):void{
 // Only bounded machine codes, counters and correlation IDs. Never bodies,
 // headers, cookies, titles, signed tokens, passwords or exception messages.
 $code=preg_match('/^[a-z0-9_]{1,96}$/D',$code)?$code:'unspecified_error';$stage=preg_match('/^[a-z_]{1,32}$/D',$stage)?$stage:'unknown';
 $uploadId=$uploadId&&preg_match('/^[a-f0-9]{32}$/D',$uploadId)?$uploadId:null;$http=(int)($detail['http']??0);$http=$http>=0&&$http<=599?$http:0;
 $format=in_array($detail['response_format']??'',['json','html','empty','other','none'],true)?$detail['response_format']:'none';$request=preg_match('/^[a-f0-9]{16}$/D',(string)($detail['request_id']??''))?$detail['request_id']:null;
 $signature=hash('sha256',json_encode([$code,$stage,$uploadId,$jobId,$http,$format]));
 $db->prepare('INSERT INTO noa_jukebox_incidents(signature,code,stage,http_status,upload_id,job_id,response_format,request_id) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE occurrences=occurrences+1,last_seen=CURRENT_TIMESTAMP,resolved_at=NULL,request_id=VALUES(request_id)')->execute([$signature,$code,$stage,$http,$uploadId,$jobId,$format,$request]);
}
function nr_storage_probe():array{$path=nj_private().'/.write-probe-'.bin2hex(random_bytes(8));error_clear_last();$f=@fopen($path,'x');if(!$f)return ['ok'=>false,'code'=>nu_storage_error()->getMessage()];try{error_clear_last();$n=@fwrite($f,'NOA');return $n===3?['ok'=>true,'code'=>null]:['ok'=>false,'code'=>nu_storage_error()->getMessage()];}finally{fclose($f);if(is_file($path))@unlink($path);}}
function nr_health(PDO $db):array{
 nr_schema($db);$runtime=$db->query('SELECT state,run_id,last_started,last_seen,last_success,last_finished,watchdog_seen,last_audit,TIMESTAMPDIFF(SECOND,last_seen,CURRENT_TIMESTAMP) heartbeat_age_seconds FROM noa_jukebox_runtime WHERE id=1')->fetch(PDO::FETCH_ASSOC);
 $q=$db->query("SELECT COUNT(*) n,COALESCE(MAX(TIMESTAMPDIFF(SECOND,uploaded_at,CURRENT_TIMESTAMP)),0) age FROM noa_jukebox_audio_jobs WHERE status IN ('queued','retrying')")->fetch(PDO::FETCH_ASSOC);
 $active=$db->query("SELECT id,worker_run_id,lease_until,heartbeat_at,TIMESTAMPDIFF(SECOND,heartbeat_at,CURRENT_TIMESTAMP) heartbeat_age_seconds FROM noa_jukebox_audio_jobs WHERE status IN ('analyzing','processing','verifying') ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
 $reason=null;if(count($active)>1)$reason='worker_concurrency_violation';elseif($active&&((int)$active[0]['heartbeat_age_seconds']>180||!$active[0]['heartbeat_at']))$reason='worker_heartbeat_stale';elseif((int)$q['n']>0&&!$active&&(int)$q['age']>600)$reason='queue_without_worker';elseif((int)$q['n']>0&&!$active&&(!$runtime['last_seen']||(int)$runtime['heartbeat_age_seconds']>900)&&(int)$q['age']>900)$reason='worker_execution_overdue';
 $probe=nr_storage_probe();$free=(int)disk_free_space(nj_private());$storage=$free>67108864&&$probe['ok'];$reserved=(int)$db->query("SELECT COALESCE(SUM(file_bytes),0) FROM noa_jukebox_uploads WHERE status<>'ready'")->fetchColumn();
 return ['ok'=>true,'can_resume'=>$storage&&!$reason,'can_upload'=>$storage&&$reserved<NU_TEMP_LIMIT&&!$reason,'reason'=>$reason,'state'=>$reason?'recovering':($active?'processing':((int)$q['n']?'waiting_worker':'healthy')),'queued'=>(int)$q['n'],'active'=>count($active),'oldest_wait_seconds'=>(int)$q['age'],'worker'=>$runtime,'active_runs'=>$active,'spool_bytes'=>$reserved,'spool_limit'=>NU_TEMP_LIMIT,'storage_available'=>$storage,'storage_code'=>$probe['code'],'checked_at'=>date(DATE_ATOM)];
}
function nr_worker(PDO $db,string $action,array $b):array{
 nr_schema($db);return nq_atomic($db,function()use($db,$action,$b){
  $r=$db->query('SELECT * FROM noa_jukebox_runtime WHERE id=1 FOR UPDATE')->fetch(PDO::FETCH_ASSOC);
  if($action==='worker_start'){
   if($r['owner']&&$r['state']==='running'&&$r['lease_until']&&strtotime($r['lease_until'])>=time())return !empty($b['owner'])&&hash_equals($r['owner'],(string)$b['owner'])&&$r['run_id']===($b['run_id']??null)?['acquired'=>true,'owner'=>$r['owner']]:['acquired'=>false];
   $run=(string)($b['run_id']??'');if(!preg_match('/^[0-9]{1,32}$/D',$run))throw new InvalidArgumentException('invalid_worker_run');$owner=preg_match('/^[a-f0-9]{32}$/D',(string)($b['owner']??''))?$b['owner']:bin2hex(random_bytes(16));$commit=preg_match('/^[a-f0-9]{40}$/D',(string)($b['source_commit']??''))?$b['source_commit']:null;
   $db->prepare("UPDATE noa_jukebox_runtime SET owner=?,run_id=?,source_commit=?,state='running',last_started=CURRENT_TIMESTAMP,last_seen=CURRENT_TIMESTAMP,lease_until=CURRENT_TIMESTAMP()+INTERVAL 10 MINUTE WHERE id=1")->execute([$owner,$run,$commit]);return ['acquired'=>true,'owner'=>$owner];
  }
  if(!is_string($b['owner']??null)||!$r['owner']||!hash_equals($r['owner'],$b['owner']))throw new DomainException('worker_owner_changed');
  if($action==='worker_heartbeat'){$db->exec("UPDATE noa_jukebox_runtime SET last_seen=CURRENT_TIMESTAMP,lease_until=CURRENT_TIMESTAMP()+INTERVAL 10 MINUTE WHERE id=1");return ['alive'=>true];}
  if($action==='worker_finish'){$db->exec("UPDATE noa_jukebox_runtime SET state='idle',last_seen=CURRENT_TIMESTAMP,last_success=CURRENT_TIMESTAMP,last_finished=CURRENT_TIMESTAMP,lease_until=NULL,owner=NULL WHERE id=1");return ['finished'=>true];}
  throw new InvalidArgumentException('unknown_worker_action');
 });
}
function nr_can_recover(PDO $db,array $j):bool{
 if(empty($j['worker_run_id']))return true; // legacy worker remains serialized by the existing workflow group
 $q=$db->prepare("SELECT state FROM noa_jukebox_worker_observations WHERE run_id=? AND checked_at>CURRENT_TIMESTAMP()-INTERVAL 5 MINUTE");$q->execute([$j['worker_run_id']]);return $q->fetchColumn()==='terminal';
}
function nr_reconcile(PDO $db,string $key,string $id):array{
 $u=nu_row($db,$id);if($u['song_key']!==$key)throw new DomainException('upload_song_mismatch');$a=nj_find($db,$key);$before=json_decode($a['source_analysis']??'null',true);$source=nu_dir($id).'/input.audio';$exists=is_file($source)&&!is_link($source);$verified=$exists&&(int)filesize($source)===(int)$u['file_bytes']&&$u['sha256']&&hash_equals($u['sha256'],hash_file('sha256',$source));$resume=nu_resume($u);
 return ['id'=>$id,'status'=>$u['status'],'source_sha256'=>$u['sha256'],'source_exists'=>$exists,'source_verified'=>(bool)$verified,'chunkSize'=>NU_CHUNK,'chunks'=>$resume['chunks'],'chunkHashes'=>$resume['chunkHashes'],'total_chunks'=>(int)$u['total_chunks'],'job'=>nq_latest($db,$id),'final_verified'=>nj_verified($a,'audio'),'source_matches_final'=>$u['sha256']&&($before['sha256']??'')===$u['sha256'],'public'=>nu_public($db,$key)];
}
function nr_state_issue(PDO $db,array $u,?array $job):?string{
 if($u['status']==='ready'&&!nj_verified(nj_find($db,$u['song_key']),'audio'))return 'ready_file_missing_or_hash_mismatch';
 if(in_array($u['status'],NQ_WAIT,true)&&(!is_file(nu_dir($u['id']).'/input.audio')||is_link(nu_dir($u['id']).'/input.audio')))return 'queued_source_missing';
 if(in_array($u['status'],NQ_ACTIVE,true)&&(!$job||!$job['heartbeat_at']||strtotime($job['heartbeat_at'])<time()-180))return 'processing_heartbeat_stale';
 if($u['status']==='failed'&&!$u['error']&&!($job['error']??null))return 'failed_without_evidence';return null;
}
function nr_maintenance(PDO $db,int $limit=12):array{
 nr_schema($db);$completed=[];$uploadCursor=(int)$db->query('SELECT upload_cursor FROM noa_jukebox_runtime WHERE id=1')->fetchColumn();$uploadRows=$db->query("SELECT * FROM noa_jukebox_uploads WHERE status='uploading' AND sequence>".$uploadCursor." AND updated_at<CURRENT_TIMESTAMP()-INTERVAL 30 SECOND ORDER BY sequence LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);foreach($uploadRows as $pending){$uploadCursor=(int)$pending['sequence'];if(count(nu_chunks($pending))===(int)$pending['total_chunks']||is_file(nu_dir($pending['id']).'/input.audio')){try{$done=nu_finish($db,$pending['id']);$completed[]=['id'=>$pending['id'],'status'=>$done['status']];}catch(Throwable $e){nr_incident($db,'assembled_upload_recovery_pending','finish',$pending['id']);}}}if(count($uploadRows)<10)$uploadCursor=0;$db->prepare('UPDATE noa_jukebox_runtime SET upload_cursor=? WHERE id=1')->execute([$uploadCursor]);$out=nq_atomic($db,function()use($db,$limit){nq_recover($db);foreach($db->query("SELECT * FROM noa_jukebox_uploads WHERE status='failed' AND file_bytes>0 ORDER BY sequence LIMIT 25") as $old){if(!is_file(nu_dir($old['id']).'/input.audio')&&!nu_chunks($old))$db->prepare('UPDATE noa_jukebox_uploads SET file_bytes=0 WHERE id=?')->execute([$old['id']]);}$cursor=(int)$db->query('SELECT audit_cursor FROM noa_jukebox_runtime WHERE id=1')->fetchColumn();
  $rows=$db->query('SELECT u.* FROM noa_jukebox_uploads u WHERE u.sequence>'.$cursor.' AND NOT EXISTS(SELECT 1 FROM noa_jukebox_uploads n WHERE n.song_key=u.song_key AND n.sequence>u.sequence) ORDER BY u.sequence LIMIT '.max(1,min(25,$limit)))->fetchAll(PDO::FETCH_ASSOC);$issues=[];
  foreach($rows as $u){$cursor=(int)$u['sequence'];$job=nq_latest($db,$u['id']);$code=null;
   $code=nr_state_issue($db,$u,$job);
   if($code==='queued_source_missing'){$db->prepare("UPDATE noa_jukebox_uploads SET status='failed',error=? WHERE id=?")->execute([$code,$u['id']]);if($job)$db->prepare("UPDATE noa_jukebox_audio_jobs SET status='failed',error=?,finished_at=CURRENT_TIMESTAMP(6) WHERE id=? AND status IN ('queued','retrying')")->execute([$code,$job['id']]);}
   if($code){nr_incident($db,$code,'consistency',$u['id'],$job['id']??null);$issues[]=['upload_id'=>$u['id'],'code'=>$code];}else $db->prepare("UPDATE noa_jukebox_incidents SET resolved_at=CURRENT_TIMESTAMP WHERE upload_id=? AND stage='consistency' AND resolved_at IS NULL")->execute([$u['id']]);
  }
  if(count($rows)<$limit)$cursor=0;$db->prepare('UPDATE noa_jukebox_runtime SET audit_cursor=?,last_audit=CURRENT_TIMESTAMP,watchdog_seen=CURRENT_TIMESTAMP WHERE id=1')->execute([$cursor]);return ['checked'=>count($rows),'issues'=>$issues];
 });$health=nr_health($db);if($health['reason'])nr_incident($db,$health['reason'],'watchdog');return $out+['uploads_recovered'=>$completed,'health'=>$health];
}
function nr_fault_setup(PDO $db,array $b):array{
 nr_schema($db);$key=(string)($b['key']??'');if(!str_starts_with($key,'jukebox:qa:')||!nj_document($db,$key))throw new DomainException('qa_song_required');$scenario=(string)($b['scenario']??'');if(!in_array($scenario,['http_503','html_response','finish_response_lost','chunk_response_lost','storage_insufficient','clear'],true))throw new InvalidArgumentException('invalid_qa_scenario');
 $session=hash('sha256',session_id());$db->prepare('UPDATE noa_jukebox_faults SET remaining=0 WHERE session_hash=?')->execute([$session]);if($scenario!=='clear')$db->prepare('INSERT INTO noa_jukebox_faults(session_hash,song_key,scenario,remaining,expires_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP()+INTERVAL 10 MINUTE)')->execute([$session,$key,$scenario,in_array($scenario,['http_503','html_response'],true)?3:1]);return ['armed'=>$scenario,'key'=>$key];
}
function nr_fault_take(PDO $db,string $session,string $key,string $action):?string{
 if(!str_starts_with($key,'jukebox:qa:'))return null;
 $q=$db->prepare('SELECT * FROM noa_jukebox_faults WHERE session_hash=? AND song_key=? AND remaining>0 AND expires_at>CURRENT_TIMESTAMP ORDER BY id DESC LIMIT 1');$q->execute([$session,$key]);$r=$q->fetch(PDO::FETCH_ASSOC);if(!$r)return null;$stage=match($r['scenario']){'http_503','html_response','chunk_response_lost'=>'chunk','finish_response_lost'=>'finish','storage_insufficient'=>'init',default=>''};if($stage!==$action)return null;
 $q=$db->prepare('UPDATE noa_jukebox_faults SET remaining=remaining-1 WHERE id=? AND remaining>0');$q->execute([$r['id']]);return $q->rowCount()?$r['scenario']:null;
}

function nr_selftest(PDO $db):array{
 nr_schema($db);$key='jukebox:qa:fifo-01';$asset=nj_find($db,$key);if(!nj_verified($asset,'audio'))throw new DomainException('qa_verified_audio_required');$before=$asset['audio_sha256'];$id=bin2hex(random_bytes(16));$dir=nu_dir($id);$tests=[];
 $check=function(bool $pass,string $label)use(&$tests){if(!$pass)throw new DomainException('recovery_selftest_failed');$tests[$label]='passed';};
 $db->beginTransaction();try{
  $db->query('SELECT id FROM noa_jukebox_queue_control WHERE id=1 FOR UPDATE')->fetch();
  $path=nj_file($asset['audio_path']);if(filesize($path)>16777216)throw new DomainException('qa_fixture_too_large');if(!copy($path,$dir.'/input.audio'))throw new RuntimeException('qa_copy_failed');chmod($dir.'/input.audio',0600);
  $db->prepare("INSERT INTO noa_jukebox_uploads(id,song_key,source_url,filename,extension,file_bytes,fingerprint,total_chunks,status,sha256,context,requested_by) VALUES(?,?,'','QA restart.mp3','mp3',?,?,1,'processing',?,'{}','recovery-selftest')")->execute([$id,$key,filesize($path),$before,$before]);
  $lease=bin2hex(random_bytes(16));$db->prepare("INSERT INTO noa_jukebox_audio_jobs(upload_id,song_key,status,attempt,worker_run_id,lease,lease_until,heartbeat_at,started_at) VALUES(?,?,'processing',1,'qa-selftest',?,CURRENT_TIMESTAMP()-INTERVAL 1 MINUTE,CURRENT_TIMESTAMP()-INTERVAL 15 MINUTE,CURRENT_TIMESTAMP()-INTERVAL 2 HOUR)")->execute([$id,$key,$lease]);$job=(int)$db->lastInsertId();
  $db->exec("INSERT INTO noa_jukebox_worker_observations(run_id,state) VALUES('qa-selftest','running') ON DUPLICATE KEY UPDATE state='running',checked_at=CURRENT_TIMESTAMP");nq_recover($db,$job);$check(nu_row($db,$id)['status']==='processing','running_ffmpeg_not_reclaimed_despite_old_start');
  $db->exec("UPDATE noa_jukebox_worker_observations SET state='terminal',checked_at=CURRENT_TIMESTAMP WHERE run_id='qa-selftest'");nq_recover($db,$job);$retry=nq_latest($db,$id);$check($retry['status']==='retrying'&&(int)$retry['retry_of']===$job&&$retry['id']>$job,'stopped_worker_restart_requeues_at_tail');
  try{nq_owned($db,['id'=>$id,'job_id'=>$job,'lease'=>$lease]);$check(false,'stale_worker_fenced');}catch(DomainException $e){$check($e->getMessage()==='upload_lease_changed','stale_worker_fenced');}
  $u=nu_row($db,$id);$check(nr_state_issue($db,$u,$retry)===null,'queued_source_exists');rename($dir.'/input.audio',$dir.'/input.part');$check(nr_state_issue($db,$u,$retry)==='queued_source_missing','queued_missing_source_detected');rename($dir.'/input.part',$dir.'/input.audio');
  $u['status']='ready';$check(nr_state_issue($db,$u,$retry)===null,'ready_file_matches_hash');$db->prepare('UPDATE noa_jukebox_assets SET audio_sha256=? WHERE song_key=?')->execute([str_repeat('0',64),$key]);$check(nr_state_issue($db,$u,$retry)==='ready_file_missing_or_hash_mismatch','ready_hash_mismatch_detected');$db->prepare('UPDATE noa_jukebox_assets SET audio_sha256=? WHERE song_key=?')->execute([$before,$key]);
  $u['status']='failed';$u['error']=null;$retry['error']=null;$check(nr_state_issue($db,$u,$retry)==='failed_without_evidence','failed_requires_evidence');
  $db->rollBack();$check(nj_verified(nj_find($db,$key),'audio')&&hash_file('sha256',$path)===$before,'confirmed_mp3_preserved');return ['tests'=>$tests,'transaction_rolled_back'=>true,'scope'=>'private_qa_only','host_reboot_performed'=>false];
 }finally{if($db->inTransaction())$db->rollBack();nu_clean(['id'=>$id]);}
}
