<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/core.php';
require_once __DIR__.'/upload-core.php';
function nj_operation(PDO $db,string $action,array $input=[]):array{
 nr_schema($db);
 if($action==='runtime_refresh'){$files=[];foreach(['service.php','operations.php','queue-core.php','recovery-core.php','upload-core.php','upload.php','index.php'] as $name){$file=__DIR__.'/'.$name;$files[$name]=['sha256'=>hash_file('sha256',$file),'invalidated'=>function_exists('opcache_invalidate')?@opcache_invalidate($file,true):null];}return ['files'=>$files,'validate_timestamps'=>ini_get('opcache.validate_timestamps'),'revalidate_seconds'=>ini_get('opcache.revalidate_freq'),'processes_terminated'=>0];}
 if($action==='qa_selftest')return nr_selftest($db);
 if($action==='verification_snapshot'){$files=[];foreach(nj_assets($db) as $key=>$asset)if(nj_verified($asset,'audio'))$files[$key]=['sha256'=>$asset['audio_sha256'],'bytes'=>(int)$asset['audio_bytes']];return ['files'=>$files,'integrity'=>nj_operation($db,'integrity_snapshot')];}
 if(in_array($action,['qa_probe','qa_upload'],true)){
  $mode=(string)($input['mode']??'');$key=(string)($input['key']??'');if($action==='qa_upload'&&$mode!=='init'&&$mode!=='latest')$key=nu_row($db,(string)($input['id']??''))['song_key'];if(!str_starts_with($key,'jukebox:qa:')||!nj_document($db,$key))throw new DomainException('qa_song_required');
  if($action==='qa_probe'){if(!in_array($mode,['http_503','html_response','empty_response','storage_insufficient'],true))throw new InvalidArgumentException('invalid_qa_scenario');return ['qa_response'=>$mode];}
  if($mode==='init'){if((int)($input['bytes']??0)>16777216)throw new InvalidArgumentException('qa_fixture_too_large');return nu_initialize($db,$input,'recovery-verification');}
  if($mode==='latest'){$u=nu_public($db,$key)['upload'];return $u?nr_reconcile($db,$key,$u['id']):['missing'=>true];}
  if($mode==='chunk'){$raw=base64_decode((string)($input['chunk']??''),true);if($raw===false||strlen($raw)>NU_CHUNK)throw new InvalidArgumentException('invalid_chunk');return nu_chunk($db,(string)$input['id'],(int)($input['index']??-1),$raw);}
  if($mode==='finish')return nu_finish($db,(string)$input['id']);
  if($mode==='status')return nr_reconcile($db,$key,(string)$input['id']);throw new InvalidArgumentException('invalid_qa_scenario');
 }
 if(in_array($action,['worker_start','worker_heartbeat','worker_finish'],true))return nr_worker($db,$action,$input);
 if($action==='runtime_health')return nr_health($db);
 if($action==='maintenance')return nr_maintenance($db);
 if($action==='worker_observation'){$run=(string)($input['run_id']??'');$state=(string)($input['state']??'');if(!preg_match('/^[0-9]{1,32}$/D',$run)||!in_array($state,['running','terminal','unknown'],true))throw new InvalidArgumentException('invalid_worker_observation');$db->prepare('INSERT INTO noa_jukebox_worker_observations(run_id,state) VALUES(?,?) ON DUPLICATE KEY UPDATE state=VALUES(state),checked_at=CURRENT_TIMESTAMP')->execute([$run,$state]);return ['recorded'=>true];}
 if($action==='upload_reconcile'){$u=nu_row($db,(string)($input['id']??''));return nr_reconcile($db,$u['song_key'],$u['id']);}
 if($action==='queue_snapshot')return nq_snapshot($db,true);
 if($action==='upload_cleanup'){$u=nu_row($db,(string)($input['id']??''));if($u['status']!=='ready')throw new DomainException('not_ready');nu_clean($u);return ['input_removed'=>!is_file(nu_dir($u['id']).'/input.audio')];}
 if($action==='capabilities')return ['php'=>PHP_VERSION,'sapi'=>PHP_SAPI,'execution_limit_seconds'=>(int)ini_get('max_execution_time'),'shell_exec_callable'=>is_callable('shell_exec'),'proc_open_callable'=>is_callable('proc_open'),'free_bytes'=>(int)disk_free_space(nj_private()),'private_media_bytes'=>array_sum(array_map(fn($a)=>(int)($a['audio_bytes']??0),nj_assets($db))),'spool_quota_bytes'=>NU_TEMP_LIMIT,'file_limit_bytes'=>NU_MAX,'processing_environment'=>'GitHub Actions Ubuntu worker; Dothome PHP upload/SQL only'];
 if($action==='export'){
  $items=[];$all=0;$saved=nj_assets($db);
  foreach($db->query("SELECT doc_key,kind,payload FROM noa_documents WHERE kind IN ('single','story') ORDER BY doc_key") as $r){
   $all++;$p=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);$b=$p['body']??[];$url=noa_sound_suno($b);if(!$url)continue;
   $a=$saved[$r['doc_key']]??null;$cached=$a&&$a['source_url']===$url&&$a['suno_id']&&$a['suno_title']&&nj_verified($a,'cover')?array_intersect_key($a,array_flip(['suno_id','suno_title','cover_path','cover_bytes','cover_sha256'])):null;
   $context=json_decode($a['catalog_context']??'{}',true);$items[]=['existing_cover'=>$cached,'key'=>$r['doc_key'],'title'=>(($b['confirmedTitle']??'')?:($p['title']??'')),'genre'=>$p['genreId']??'unclassified','ep'=>$p['ep']??'','sunoUrl'=>$url,'originalArtist'=>(($b['originalArtist']??$b['originalSinger']??'')?:($context['originalArtist']??''))];
  }
  $count=null;try{$count=(int)$db->query('SELECT COUNT(*) FROM noa_catalog_songs')->fetchColumn();}catch(PDOException $e){}
  return ['catalog_song_records'=>$count,'database_music_records'=>$all,'total_suno_urls'=>count($items),'items'=>$items];
 }
 if($action==='import'){
  if(count($input['results']??[])>25)throw new InvalidArgumentException('batch_limit');
  nj_schema($db);$success=0;$errors=[];
  foreach($input['results']??[] as $r){try{nj_import($db,$r);$success++;}catch(Throwable $e){$errors[]=['key'=>$r['song_key']??'','error'=>$e->getMessage()];}}
  return ['saved'=>$success,'errors'=>$errors];
 }
 if($action==='audit'){
  $rows=nj_assets($db);$out=['assets'=>count($rows),'covers'=>0,'audio'=>0,'audio_bytes'=>0,'invalid'=>[]];
  $out['qa_assets']=0;foreach($rows as $key=>$r){if(str_starts_with($key,'jukebox:qa:')){$out['qa_assets']++;$out['assets']--;continue;}foreach(['cover','audio'] as $type){if(nj_verified($r,$type)){$out[$type==='cover'?'covers':'audio']++;if($type==='audio')$out['audio_bytes']+=(int)$r['audio_bytes'];}elseif(!empty($r[$type.'_path']))$out['invalid'][]=['key'=>$key,'type'=>$type];}}
  $out['qa_results']=[];foreach($rows as $key=>$r)if(str_starts_with($key,'jukebox:qa:'))$out['qa_results'][]=['key'=>$key,'ready'=>nj_verified($r,'audio'),'cover'=>nj_verified($r,'cover'),'audio_path'=>$r['audio_path'],'cover_path'=>$r['cover_path'],'sha256'=>$r['audio_sha256'],'bytes'=>(int)$r['audio_bytes'],'source'=>json_decode($r['source_analysis']??'null',true),'correction'=>json_decode($r['correction']??'null',true),'final'=>json_decode($r['final_analysis']??'null',true)];
  $out['download_logs']=(int)$db->query('SELECT COUNT(*) FROM noa_jukebox_downloads')->fetchColumn();$out['temporary_input_states']=[];
  foreach(glob(nj_private().'/incoming/*/input.audio') as $file){$id=basename(dirname($file));$q=$db->prepare('SELECT id,song_key,status,sha256 FROM noa_jukebox_uploads WHERE id=?');$q->execute([$id]);$u=$q->fetch(PDO::FETCH_ASSOC);
   if($u&&$u['status']==='ready'&&$u['sha256']&&hash_equals($u['sha256'],hash_file('sha256',$file)))nu_clean($u);
   else $out['temporary_input_states'][]=$u?['id'=>$id,'key'=>$u['song_key'],'status'=>$u['status']]:['id'=>$id,'status'=>'unregistered_temporary_input'];
  }
  $out['temporary_inputs']=count(glob(nj_private().'/incoming/*/input.audio'));return $out;
 }
 if($action==='integrity_snapshot'){
  $h=hash_init('sha256');$n=0;foreach($db->query("SELECT doc_key,kind,payload,revision,updated_by FROM noa_documents WHERE kind<>'jukebox_qa' ORDER BY doc_key") as $r){hash_update($h,json_encode(array_values($r),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));$n++;}
  global $g5;$table=$g5['member_table']??'';$members=preg_match('/^[A-Za-z0-9_]+$/D',$table)?(int)$db->query('SELECT COUNT(*) FROM `'.$table.'`')->fetchColumn():null;return ['documents'=>$n,'documents_sha256'=>hash_final($h),'members'=>$members];
 }
 if($action==='jobs'){
  nj_schema($db);$db->exec("UPDATE noa_jukebox_jobs SET status='queued' WHERE status='running' AND created_at<CURRENT_TIMESTAMP()-INTERVAL 3 HOUR");
  nu_housekeeping($db);nq_migrate($db);nq_atomic($db,fn()=>nq_recover($db));return ['queued'=>(int)$db->query("SELECT COUNT(*) FROM noa_jukebox_jobs WHERE status='queued'")->fetchColumn(),'uploads'=>(int)$db->query("SELECT COUNT(*) FROM noa_jukebox_uploads WHERE status IN ('queued','retrying','analyzing','processing','verifying') AND (lease_until IS NULL OR lease_until<CURRENT_TIMESTAMP())")->fetchColumn()];
 }
 if($action==='claim'){
  nj_schema($db);$db->beginTransaction();try{
   // The dedicated worker concurrency group guarantees one live claimant.
   $db->exec("UPDATE noa_jukebox_jobs SET status='queued' WHERE status='running'");
   $ids=$db->query("SELECT id FROM noa_jukebox_jobs WHERE status='queued' ORDER BY id LIMIT 200 FOR UPDATE")->fetchAll(PDO::FETCH_COLUMN);
   if($ids){$q=$db->prepare("UPDATE noa_jukebox_jobs SET status='running' WHERE status='queued' AND id IN (".implode(',',array_fill(0,count($ids),'?')).")");$q->execute($ids);}
   $db->commit();return ['ids'=>array_map('intval',$ids)];
  }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
 }
 if($action==='finish'){
  $ids=$input['ids']??[];if(!is_array($ids)||count($ids)>200)throw new InvalidArgumentException('job_limit');
  foreach($ids as $id)if(!is_int($id)||$id<1)throw new InvalidArgumentException('job_id');
  if($ids){$q=$db->prepare("UPDATE noa_jukebox_jobs SET status='completed',finished_at=CURRENT_TIMESTAMP() WHERE status='running' AND id IN (".implode(',',array_fill(0,count($ids),'?')).")");$q->execute($ids);}
  return ['finished'=>count($ids)];
 }
 if($action==='qa_setup'){
  nj_schema($db);$key='jukebox:qa:upload-pipeline';$p=['title'=>'JUKEBOX 검증용 합성 음악 · 실제 카탈로그 곡 아님','genreId'=>'qa-verification','visibility'=>'private','body'=>['confirmedTitle'=>'JUKEBOX 검증용 합성 음악 · 실제 카탈로그 곡 아님','lyricsBlock'=>'업로드·분석·재생·다운로드 전체 흐름 검증 전용. 실제 카탈로그 곡 수에서 제외합니다.']];
  $db->prepare("INSERT IGNORE INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,'jukebox_qa',?,1,'jukebox-worker')")->execute([$key,json_encode($p,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);$dir=nj_private().'/media/검증/업로드 흐름 검증';if(!is_dir($dir)&&!mkdir($dir,0700,true))throw new RuntimeException('qa_directory');$cover=$dir.'/cover.webp';$bytes=base64_decode('UklGRvwAAABXRUJQVlA4IPAAAABwCQCdASqAAIAAPjEYi0QiIaERTMwAIAMEtLdwuOg7Cu6BOx3qXf4PgAP1ACLWun0Js8zH018RB88P/5EuQlYsDjy+VWgE/gWzzMfTXxEH018Q7AAA/v+Y6Ptk7DABO/olsUY2/NoD//v/lKFKwYePbKgmM+MX9Lh0tWtG/H/0kn9L9v//aPygJqcGFTRonZnQLcmWhgavHJ+f8fP+aaR+VfybROWX5Ltc/v/qy/uH7xvvm7BlAmpfH9Gs5v+WyeDHirZKN/x+6qABxSDXQgB6x8Jzvn36ttrmdGF3MUJkptHpqOJZGgSfPunrMwAAAAA=',true);if(!is_file($cover)){file_put_contents($cover,$bytes);chmod($cover,0600);}if(hash_file('sha256',$cover)!==hash('sha256',$bytes))throw new DomainException('qa_cover_changed');nj_import($db,['song_key'=>$key,'source_url'=>'','suno_id'=>'','suno_title'=>'JUKEBOX 검증용 합성 음악','cover_path'=>'검증/업로드 흐름 검증/cover.webp','cover_bytes'=>strlen($bytes),'cover_sha256'=>hash('sha256',$bytes),'errors'=>[]]);$key2='jukebox:qa:upload-mp3';$p['title']='JUKEBOX MP3 업로드 검증용 합성 음악 · 실제 곡 아님';$p['body']['confirmedTitle']=$p['title'];$db->prepare("INSERT IGNORE INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,'jukebox_qa',?,1,'jukebox-worker')")->execute([$key2,json_encode($p,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);$dir2=nj_private().'/media/검증/MP3 업로드 검증';if(!is_dir($dir2)&&!mkdir($dir2,0700,true))throw new RuntimeException('qa_directory');if(!is_file($dir2.'/cover.webp')){file_put_contents($dir2.'/cover.webp',$bytes);chmod($dir2.'/cover.webp',0600);}nj_import($db,['song_key'=>$key2,'source_url'=>'','suno_id'=>'','suno_title'=>'JUKEBOX MP3 업로드 검증용 합성 음악','cover_path'=>'검증/MP3 업로드 검증/cover.webp','cover_bytes'=>strlen($bytes),'cover_sha256'=>hash('sha256',$bytes),'errors'=>[]]);
  foreach(range(1,10) as $n){$number=str_pad((string)$n,2,'0',STR_PAD_LEFT);$qkey='jukebox:qa:fifo-'.$number;$p['title']='FIFO '.$number.' · 검증 전용 합성 음악';$p['body']['confirmedTitle']=$p['title'];$db->prepare("INSERT IGNORE INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,'jukebox_qa',?,1,'jukebox-worker')")->execute([$qkey,json_encode($p,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);$relative='검증/FIFO '.$number.'/cover.webp';$dir=nj_private().'/media/'.dirname($relative);if(!is_dir($dir)&&!mkdir($dir,0700,true))throw new RuntimeException('qa_directory');if(!is_file($dir.'/cover.webp')){file_put_contents($dir.'/cover.webp',$bytes);chmod($dir.'/cover.webp',0600);}nj_import($db,['song_key'=>$qkey,'source_url'=>'','suno_title'=>'FIFO '.$number.' 검증용 합성 음악','cover_path'=>$relative,'cover_bytes'=>strlen($bytes),'cover_sha256'=>hash('sha256',$bytes),'errors'=>[]]);}
  return ['key'=>$key,'second_key'=>$key2,'fifo_keys'=>['jukebox:qa:fifo-01','jukebox:qa:fifo-02','jukebox:qa:fifo-03'],'separate_from_catalog'=>true];
 }
 if($action==='upload_claim')return nq_claim($db,$input['worker_owner']??null);
 if(in_array($action,['upload_state','upload_fail','upload_commit','upload_heartbeat'],true))return nq_atomic($db,function()use($db,$action,$input){
  $job=nq_owned($db,$input);
  $u=nu_row($db,(string)($input['id']??''));if(!is_string($input['lease']??null)||!$u['lease']||!hash_equals($u['lease'],$input['lease'])||!in_array($u['status'],NQ_ACTIVE,true))throw new DomainException('upload_lease_changed');
  if($action==='upload_heartbeat'){
   $db->prepare("UPDATE noa_jukebox_audio_jobs SET heartbeat_at=CURRENT_TIMESTAMP,lease_until=CURRENT_TIMESTAMP()+INTERVAL 10 MINUTE WHERE id=?")->execute([$job['id']]);
   $db->prepare("UPDATE noa_jukebox_uploads SET lease_until=CURRENT_TIMESTAMP()+INTERVAL 10 MINUTE WHERE id=?")->execute([$u['id']]);return ['alive'=>true];
  }
  if($action==='upload_fail'){
   $error=preg_replace('/[^a-zA-Z0-9_:-]/','_',substr((string)($input['error']??'audio_processing_failed'),0,190));
   $db->prepare("UPDATE noa_jukebox_audio_jobs SET status='failed',error=?,finished_at=CURRENT_TIMESTAMP(6),lease=NULL,lease_until=NULL WHERE id=?")->execute([$error,$job['id']]);
   $db->prepare("UPDATE noa_jukebox_uploads SET status='failed',error=?,lease=NULL,lease_until=NULL WHERE id=?")->execute([$error,$u['id']]);
   $retryable=in_array($error,['upload_processing_failed','hosting_storage_insufficient','cover_copy_failed'],true);
   if($retryable&&(int)$job['attempt']<NQ_MAX_ATTEMPTS)nq_insert($db,$u,'retrying',(int)$job['attempt']+1,(int)$job['id']);return ['failed'=>true,'retrying'=>$retryable&&(int)$job['attempt']<NQ_MAX_ATTEMPTS];
  }
  if($action==='upload_state'){
   $state=$input['status']??'';if($job['status']===$state&&in_array($state,['processing','verifying'],true)){if($state==='processing'&&($input['source_analysis']['sha256']??'')!==$u['sha256'])throw new DomainException('source_hash_mismatch');return ['status'=>$state,'response_recovered'=>true];}$expected=['processing'=>'analyzing','verifying'=>'processing'];if(!isset($expected[$state])||$job['status']!==$expected[$state])throw new InvalidArgumentException('invalid_processing_state');
   if($state==='processing'){$before=$input['source_analysis']??[];if(($before['sha256']??'')!==$u['sha256'])throw new DomainException('source_hash_mismatch');$db->prepare("UPDATE noa_jukebox_uploads SET source_analysis=? WHERE id=?")->execute([json_encode($before,JSON_THROW_ON_ERROR),$u['id']]);}
   $db->prepare('UPDATE noa_jukebox_uploads SET status=? WHERE id=?')->execute([$state,$u['id']]);$db->prepare('UPDATE noa_jukebox_audio_jobs SET status=?,heartbeat_at=CURRENT_TIMESTAMP WHERE id=?')->execute([$state,$job['id']]);return ['status'=>$state];
  }
  if($job['status']!=='verifying')throw new DomainException('verification_stage_required');
  $r=$input['result']??[];if(($r['song_key']??'')!==$u['song_key']||($r['source_url']??null)!==$u['source_url']||($r['source_analysis']['sha256']??'')!==$u['sha256'])throw new DomainException('upload_result_identity_mismatch');
  $path=nj_file((string)($r['audio_path']??''));$root=realpath(nj_private().'/media');if(!$root||!$path||!str_starts_with($path,$root.'/'))throw new DomainException('private_output_missing');
  $a=nj_find($db,$u['song_key']);$cover=nj_verified($a,'cover')?nj_file($a['cover_path']):null;
  if($cover){$target=dirname($path).'/cover.webp';if(!is_file($target)){if(!copy($cover,$target))throw new RuntimeException('cover_copy_failed');chmod($target,0600);}if(!hash_equals($a['cover_sha256'],hash_file('sha256',$target)))throw new DomainException('cover_copy_conflict');$r['cover_path']=dirname($r['audio_path']).'/cover.webp';$r['cover_bytes']=filesize($target);$r['cover_sha256']=hash_file('sha256',$target);}
  if(!nj_verified($a,'audio')||!hash_equals($a['audio_sha256'],(string)($r['audio_sha256']??'')))nj_import($db,$r,true,$u['previous_sha256']);
  $db->prepare("UPDATE noa_jukebox_uploads SET status='ready',source_analysis=?,correction=?,final_analysis=?,error=NULL,lease=NULL,lease_until=NULL WHERE id=?")->execute([json_encode($r['source_analysis'],JSON_THROW_ON_ERROR),json_encode($r['correction'],JSON_THROW_ON_ERROR),json_encode($r['final_analysis'],JSON_THROW_ON_ERROR),$u['id']]);$db->prepare("UPDATE noa_jukebox_audio_jobs SET status='ready',finished_at=CURRENT_TIMESTAMP(6),heartbeat_at=CURRENT_TIMESTAMP,lease=NULL,lease_until=NULL,error=NULL WHERE id=?")->execute([$job['id']]);return ['ready'=>true,'audio_sha256'=>$r['audio_sha256'],'input_removed'=>false];
 });
 throw new InvalidArgumentException('unknown_fixed_operation');
}
