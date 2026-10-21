<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/core.php';
function nj_operation(PDO $db,string $action,array $input=[]):array{
 if($action==='export'){
  $items=[];$all=0;$saved=nj_assets($db);
  foreach($db->query("SELECT doc_key,kind,payload FROM noa_documents WHERE kind IN ('single','story') ORDER BY doc_key") as $r){
   $all++;$p=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);$b=$p['body']??[];$url=noa_sound_suno($b);if(!$url)continue;
   $a=$saved[$r['doc_key']]??null;$cached=$a&&$a['source_url']===$url&&$a['suno_id']&&$a['suno_title']&&nj_verified($a,'cover')?array_intersect_key($a,array_flip(['suno_id','suno_title','cover_path','cover_bytes','cover_sha256'])):null;
   $items[]=['existing_cover'=>$cached,'key'=>$r['doc_key'],'title'=>(($b['confirmedTitle']??'')?:($p['title']??'')),'genre'=>$p['genreId']??'unclassified','ep'=>$p['ep']??'','sunoUrl'=>$url,'originalArtist'=>$b['originalArtist']??$b['originalSinger']??''];
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
  foreach($rows as $key=>$r){foreach(['cover','audio'] as $type){if(nj_verified($r,$type)){$out[$type==='cover'?'covers':'audio']++;if($type==='audio')$out['audio_bytes']+=(int)$r['audio_bytes'];}elseif(!empty($r[$type.'_path']))$out['invalid'][]=['key'=>$key,'type'=>$type];}}
  return $out;
 }
 if($action==='jobs'){
  nj_schema($db);$db->exec("UPDATE noa_jukebox_jobs SET status='queued' WHERE status='running' AND created_at<UTC_TIMESTAMP()-INTERVAL 3 HOUR");
  return ['queued'=>(int)$db->query("SELECT COUNT(*) FROM noa_jukebox_jobs WHERE status='queued'")->fetchColumn()];
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
  if($ids){$q=$db->prepare("UPDATE noa_jukebox_jobs SET status='completed',finished_at=UTC_TIMESTAMP() WHERE status='running' AND id IN (".implode(',',array_fill(0,count($ids),'?')).")");$q->execute($ids);}
  return ['finished'=>count($ids)];
 }
 throw new InvalidArgumentException('unknown_fixed_operation');
}
