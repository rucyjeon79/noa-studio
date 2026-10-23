<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
define('_GNUBOARD_',true);$web=dirname(__DIR__,2);
require $web.'/data/dbconfig.php';require $web.'/noa-bridge/storage.php';require $web.'/noa-bridge/sound-core.php';require __DIR__.'/core.php';
try{
 $db=noa_bridge_pdo();$action=$argv[1]??'export';
 if($action==='export'){
  $items=[];$all=0;foreach($db->query("SELECT doc_key,kind,payload FROM noa_documents WHERE kind IN ('single','story') ORDER BY doc_key") as $r){$all++;$p=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);$b=$p['body']??[];$url=noa_sound_suno($b);if(!$url)continue;$items[]=['key'=>$r['doc_key'],'title'=>(($b['confirmedTitle']??'')?:($p['title']??'')),'genre'=>$p['genreId']??'unclassified','ep'=>$p['ep']??'','sunoUrl'=>$url,'originalArtist'=>$b['originalArtist']??$b['originalSinger']??''];}
  $catalogCount=null;try{$catalogCount=(int)$db->query('SELECT COUNT(*) FROM noa_catalog_songs')->fetchColumn();}catch(PDOException $e){}
  echo json_encode(['catalog_song_records'=>$catalogCount,'database_music_records'=>$all,'total_suno_urls'=>count($items),'items'=>$items],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;
 }
 if($action==='import'){
  nj_schema($db);$input=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$success=0;$errors=[];
  foreach($input['results']??[] as $r){try{nj_import($db,$r);$success++;}catch(Throwable $e){$errors[]=['key'=>$r['song_key']??'','error'=>$e->getMessage()];}}
  echo json_encode(['saved'=>$success,'errors'=>$errors],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit($errors?2:0);
 }
 if($action==='n80_emit_ready_batch'){
  // Bounded, opt-in CLI sweep. Existing ready records only; no FIFO mutation.
  require_once dirname(__DIR__).'/engine/readonly-pipeline.php';
  if(getenv('N80_CLI_EMIT_ENABLED')!=='1')throw new DomainException('n80_emit_disabled');
  $directory=getenv('N80_PRIVATE_EVENT_DIR')?:'';
  if($directory==='')throw new InvalidArgumentException('n80_private_directory_required');
  $limit=filter_var($argv[2]??'25',FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>100]]);
  if(!$limit)throw new InvalidArgumentException('invalid_batch_limit');
  $q=$db->prepare("SELECT j.id FROM noa_jukebox_audio_jobs j
    JOIN noa_jukebox_uploads u ON u.id=j.upload_id
    WHERE j.status='ready' AND u.status='ready'
      AND j.id=(SELECT MAX(j2.id) FROM noa_jukebox_audio_jobs j2
        JOIN noa_jukebox_uploads u2 ON u2.id=j2.upload_id WHERE u2.song_key=u.song_key)
    ORDER BY j.id DESC LIMIT ".(int)$limit);
  $q->execute();
  $ctx=['authenticatedByServer'=>true,'principal'=>'jukebox_worker','permission'=>'catalog:read'];
  $summary=['examined'=>0,'recorded'=>0,'already_stored'=>0,'rejected'=>0];
  foreach($q->fetchAll(PDO::FETCH_COLUMN) as $jobId){
    $summary['examined']++;
    $ready=n80_ready_event_from_job($db,(int)$jobId);
    if(!$ready['ok']){$summary['rejected']++;continue;}
    $result=n80_verified_ready_pipeline($db,$directory,$ready['event'],$ctx);
    if(!$result['ok']){$summary['rejected']++;continue;}
    if($result['storageStatus']==='stored')$summary['recorded']++;
    else $summary['already_stored']++;
  }
  echo json_encode($summary,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES).PHP_EOL;
  exit($summary['rejected']?2:0);
 }
 if($action==='n80_emit_ready'){
  // CLI-only trusted process; opt-in, no new public route or FIFO changes.
  require_once dirname(__DIR__).'/engine/readonly-pipeline.php';
  if(getenv('N80_CLI_EMIT_ENABLED')!=='1')throw new DomainException('n80_emit_disabled');
  $jobId=filter_var($argv[2]??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
  $directory=getenv('N80_PRIVATE_EVENT_DIR')?:'';
  if(!$jobId||$directory==='')throw new InvalidArgumentException('n80_job_and_private_directory_required');
  $ready=n80_ready_event_from_job($db,(int)$jobId);
  if(!$ready['ok'])throw new DomainException($ready['error']);
  $context=['authenticatedByServer'=>true,'principal'=>'jukebox_worker','permission'=>'catalog:read'];
  $result=n80_verified_ready_pipeline($db,$directory,$ready['event'],$context);
  echo json_encode($result,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES).PHP_EOL;
  exit($result['ok']?0:2);
 }
 if($action==='audit'){
  $rows=nj_assets($db);$out=['assets'=>count($rows),'covers'=>0,'audio'=>0,'audio_bytes'=>0,'invalid'=>[]];
  foreach($rows as $key=>$r){foreach(['cover','audio'] as $type){if(nj_verified($r,$type)){$out[$type==='cover'?'covers':'audio']++;if($type==='audio')$out['audio_bytes']+=(int)$r['audio_bytes'];}elseif(!empty($r[$type.'_path']))$out['invalid'][]=['key'=>$key,'type'=>$type];}}
  echo json_encode($out,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;
 }
 throw new InvalidArgumentException('unknown_action');
}catch(Throwable $e){fwrite(STDERR,get_class($e).': '.$e->getMessage().PHP_EOL);exit(1);}
