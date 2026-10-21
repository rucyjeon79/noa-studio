<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
const NQ_ACTIVE=['analyzing','processing','verifying'];
const NQ_WAIT=['queued','retrying'];
const NQ_MAX_ATTEMPTS=3;
function nq_atomic(PDO $db,callable $fn):mixed{
 $db->beginTransaction();try{$db->query('SELECT id FROM noa_jukebox_queue_control WHERE id=1 FOR UPDATE')->fetch();$result=$fn();$db->commit();return $result;}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
function nq_insert(PDO $db,array $u,string $status='queued',int $attempt=1,?int $retryOf=null):int{
 $db->prepare('INSERT INTO noa_jukebox_audio_jobs(upload_id,song_key,status,attempt,retry_of) VALUES(?,?,?,?,?)')->execute([$u['id'],$u['song_key'],$status,$attempt,$retryOf]);$id=(int)$db->lastInsertId();
 $db->prepare('UPDATE noa_jukebox_uploads SET status=?,lease=NULL,lease_until=NULL,error=NULL WHERE id=?')->execute([$status,$u['id']]);return $id;
}
function nq_enqueue(PDO $db,array $u):int{return nq_atomic($db,function()use($db,$u){$q=$db->prepare("SELECT id FROM noa_jukebox_audio_jobs WHERE upload_id=? ORDER BY id DESC LIMIT 1");$q->execute([$u['id']]);$id=$q->fetchColumn();return $id?(int)$id:nq_insert($db,$u);});}
function nq_migrate(PDO $db):void{
 // Adopt old completed uploads only; never reset an existing queue or confirmed asset.
 nq_atomic($db,function()use($db){$rows=$db->query("SELECT u.* FROM noa_jukebox_uploads u WHERE u.status IN ('analyzing','processing') AND (u.lease_until IS NULL OR u.lease_until<CURRENT_TIMESTAMP) AND NOT EXISTS(SELECT 1 FROM noa_jukebox_audio_jobs j WHERE j.upload_id=u.id) ORDER BY u.updated_at,u.sequence")->fetchAll(PDO::FETCH_ASSOC);foreach($rows as $u)nq_insert($db,$u);});
}
function nq_position(PDO $db,?array $job):?int{
 if(!$job||!in_array($job['status'],NQ_WAIT,true))return null;$q=$db->prepare("SELECT COUNT(*) FROM noa_jukebox_audio_jobs WHERE status IN ('queued','retrying') AND id<=? AND available_at<=CURRENT_TIMESTAMP");$q->execute([$job['id']]);return (int)$q->fetchColumn();
}
function nq_latest(PDO $db,string $id):?array{$q=$db->prepare('SELECT * FROM noa_jukebox_audio_jobs WHERE upload_id=? ORDER BY id DESC LIMIT 1');$q->execute([$id]);$r=$q->fetch(PDO::FETCH_ASSOC)?:null;if($r){$r['id']=(int)$r['id'];$r['attempt']=(int)$r['attempt'];$r['position']=nq_position($db,$r);unset($r['lease'],$r['lease_until']);}return $r;}
function nq_recover(PDO $db):void{
 $rows=$db->query("SELECT * FROM noa_jukebox_audio_jobs WHERE status IN ('analyzing','processing','verifying') AND lease_until<CURRENT_TIMESTAMP FOR UPDATE")->fetchAll(PDO::FETCH_ASSOC);
 foreach($rows as $j){$db->prepare("UPDATE noa_jukebox_audio_jobs SET status='failed',error='worker_lease_expired',finished_at=CURRENT_TIMESTAMP(6),lease=NULL,lease_until=NULL WHERE id=?")->execute([$j['id']]);$u=nu_row($db,$j['upload_id']);
  $db->prepare("UPDATE noa_jukebox_uploads SET status='failed',error='worker_lease_expired',lease=NULL,lease_until=NULL WHERE id=?")->execute([$u['id']]);
  if((int)$j['attempt']<NQ_MAX_ATTEMPTS&&is_file(nu_dir($u['id']).'/input.audio'))nq_insert($db,$u,'retrying',(int)$j['attempt']+1,(int)$j['id']);
 }
}
function nq_claim(PDO $db):array{
 return nq_atomic($db,function()use($db){nq_recover($db);
  if($db->query("SELECT id FROM noa_jukebox_audio_jobs WHERE status IN ('analyzing','processing','verifying') LIMIT 1")->fetchColumn())return ['uploads'=>[]];
  if($db->query("SELECT id FROM noa_jukebox_uploads WHERE status IN ('analyzing','processing') AND lease_until>=CURRENT_TIMESTAMP AND NOT EXISTS(SELECT 1 FROM noa_jukebox_audio_jobs j WHERE j.upload_id=noa_jukebox_uploads.id) LIMIT 1")->fetchColumn())return ['uploads'=>[]];
  $j=$db->query("SELECT * FROM noa_jukebox_audio_jobs WHERE status IN ('queued','retrying') AND available_at<=CURRENT_TIMESTAMP ORDER BY id LIMIT 1 FOR UPDATE")->fetch(PDO::FETCH_ASSOC);if(!$j)return ['uploads'=>[]];
  $u=nu_row($db,$j['upload_id']);$lease=bin2hex(random_bytes(16));
  $db->prepare("UPDATE noa_jukebox_audio_jobs SET status='analyzing',started_at=CURRENT_TIMESTAMP(6),heartbeat_at=CURRENT_TIMESTAMP,lease=?,lease_until=CURRENT_TIMESTAMP()+INTERVAL 10 MINUTE,error=NULL WHERE id=?")->execute([$lease,$j['id']]);
  $db->prepare("UPDATE noa_jukebox_uploads SET status='analyzing',lease=?,lease_until=CURRENT_TIMESTAMP()+INTERVAL 10 MINUTE,error=NULL WHERE id=?")->execute([$lease,$u['id']]);$a=nj_find($db,$u['song_key']);
  return ['uploads'=>[['job_id'=>(int)$j['id'],'attempt'=>(int)$j['attempt'],'id'=>$u['id'],'key'=>$u['song_key'],'lease'=>$lease,'sha256'=>$u['sha256'],'bytes'=>(int)$u['file_bytes'],'extension'=>$u['extension'],'source_url'=>$u['source_url'],'context'=>json_decode($u['context'],true),'previous_sha256'=>$u['previous_sha256'],'cover_path'=>nj_verified($a,'cover')?$a['cover_path']:null]]];
 });
}
function nq_owned(PDO $db,array $input):array{
 $q=$db->prepare("SELECT * FROM noa_jukebox_audio_jobs WHERE id=? AND upload_id=? AND lease=? AND status IN ('analyzing','processing','verifying') AND lease_until>=CURRENT_TIMESTAMP FOR UPDATE");$q->execute([(int)($input['job_id']??0),(string)($input['id']??''),(string)($input['lease']??'')]);$j=$q->fetch(PDO::FETCH_ASSOC);if(!$j)throw new DomainException('upload_lease_changed');return $j;
}
function nq_retry(PDO $db,string $id):void{
 nq_atomic($db,function()use($db,$id){$u=nu_row($db,$id);$j=nq_latest($db,$id);if($u['status']!=='failed'||!is_file(nu_dir($id).'/input.audio'))throw new DomainException('reselect_source_file');if(!$j||(int)$j['attempt']>=NQ_MAX_ATTEMPTS)throw new DomainException('retry_limit_reselect_source');
  if(!in_array($j['error'],['worker_lease_expired','upload_processing_failed','hosting_storage_insufficient','cover_copy_failed','processing_state_changed_or_network_error'],true))throw new DomainException('non_retryable_reselect_source');
  $q=$db->prepare("SELECT id FROM noa_jukebox_uploads WHERE song_key=? AND id<>? AND status IN ('uploading','queued','retrying','analyzing','processing','verifying') LIMIT 1");$q->execute([$u['song_key'],$id]);if($q->fetchColumn())throw new DomainException('another_upload_is_active');nq_insert($db,$u,'retrying',(int)$j['attempt']+1,(int)$j['id']);
 });
}
function nq_snapshot(PDO $db,bool $qa=false):array{
 $filter=$qa?'1=1':"u.song_key NOT LIKE 'jukebox:qa:%'";$counts=[];foreach($db->query("SELECT status,COUNT(*) n FROM noa_jukebox_uploads u WHERE $filter GROUP BY status") as $r)$counts[$r['status']]=(int)$r['n'];
 $sql="SELECT j.id,j.upload_id,j.song_key,j.status,j.uploaded_at,j.started_at,j.finished_at,j.attempt,j.retry_of,j.error,j.heartbeat_at,u.filename,u.context FROM noa_jukebox_audio_jobs j JOIN noa_jukebox_uploads u ON u.id=j.upload_id WHERE $filter ORDER BY (j.status IN ('analyzing','processing','verifying')) DESC,(j.status IN ('queued','retrying')) DESC,IF(j.status IN ('queued','retrying'),j.id,-j.id) LIMIT 600";$rows=$db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
 $positions=[];$rank=0;foreach($db->query("SELECT id FROM noa_jukebox_audio_jobs WHERE status IN ('queued','retrying') AND available_at<=CURRENT_TIMESTAMP ORDER BY id") as $wait)$positions[(int)$wait['id']]=++$rank;
 foreach($rows as &$r){$r['id']=(int)$r['id'];$r['position']=$positions[$r['id']]??null;$c=json_decode($r['context'],true);$r['title']=$c['title']??$r['song_key'];unset($r['context']);}unset($r);
 return ['counts'=>$counts,'total_uploads'=>array_sum($counts),'rows'=>$rows,'concurrency'=>1,'automatic_attempt_limit'=>NQ_MAX_ATTEMPTS,'checked_at'=>date(DATE_ATOM)];
}
