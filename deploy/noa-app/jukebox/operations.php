<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/core.php';
require_once __DIR__.'/upload-core.php';
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
  $out['qa_assets']=0;foreach($rows as $key=>$r){if(str_starts_with($key,'jukebox:qa:')){$out['qa_assets']++;$out['assets']--;continue;}foreach(['cover','audio'] as $type){if(nj_verified($r,$type)){$out[$type==='cover'?'covers':'audio']++;if($type==='audio')$out['audio_bytes']+=(int)$r['audio_bytes'];}elseif(!empty($r[$type.'_path']))$out['invalid'][]=['key'=>$key,'type'=>$type];}}
  return $out;
 }
 if($action==='jobs'){
  nj_schema($db);$db->exec("UPDATE noa_jukebox_jobs SET status='queued' WHERE status='running' AND created_at<CURRENT_TIMESTAMP()-INTERVAL 3 HOUR");
  nu_housekeeping($db);return ['queued'=>(int)$db->query("SELECT COUNT(*) FROM noa_jukebox_jobs WHERE status='queued'")->fetchColumn(),'uploads'=>(int)$db->query("SELECT COUNT(*) FROM noa_jukebox_uploads WHERE status IN ('analyzing','processing') AND (lease_until IS NULL OR lease_until<CURRENT_TIMESTAMP())")->fetchColumn()];
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
  $db->prepare("INSERT IGNORE INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,'jukebox_qa',?,1,'jukebox-worker')")->execute([$key,json_encode($p,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);$dir=nj_private().'/media/검증/업로드 흐름 검증';if(!is_dir($dir)&&!mkdir($dir,0700,true))throw new RuntimeException('qa_directory');$cover=$dir.'/cover.webp';$bytes=base64_decode('UklGRvwAAABXRUJQVlA4IPAAAABwCQCdASqAAIAAPjEYi0QiIaERTMwAIAMEtLdwuOg7Cu6BOx3qXf4PgAP1ACLWun0Js8zH018RB88P/5EuQlYsDjy+VWgE/gWzzMfTXxEH018Q7AAA/v+Y6Ptk7DABO/olsUY2/NoD//v/lKFKwYePbKgmM+MX9Lh0tWtG/H/0kn9L9v//aPygJqcGFTRonZnQLcmWhgavHJ+f8fP+aaR+VfybROWX5Ltc/v/qy/uH7xvvm7BlAmpfH9Gs5v+WyeDHirZKN/x+6qABxSDXQgB6x8Jzvn36ttrmdGF3MUJkptHpqOJZGgSfPunrMwAAAAA=',true);if(!is_file($cover)){file_put_contents($cover,$bytes);chmod($cover,0600);}if(hash_file('sha256',$cover)!==hash('sha256',$bytes))throw new DomainException('qa_cover_changed');nj_import($db,['song_key'=>$key,'source_url'=>'','suno_id'=>'','suno_title'=>'JUKEBOX 검증용 합성 음악','cover_path'=>'검증/업로드 흐름 검증/cover.webp','cover_bytes'=>strlen($bytes),'cover_sha256'=>hash('sha256',$bytes),'errors'=>[]]);$key2='jukebox:qa:upload-mp3';$p['title']='JUKEBOX MP3 업로드 검증용 합성 음악 · 실제 곡 아님';$p['body']['confirmedTitle']=$p['title'];$db->prepare("INSERT IGNORE INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,'jukebox_qa',?,1,'jukebox-worker')")->execute([$key2,json_encode($p,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);$dir2=nj_private().'/media/검증/MP3 업로드 검증';if(!is_dir($dir2)&&!mkdir($dir2,0700,true))throw new RuntimeException('qa_directory');if(!is_file($dir2.'/cover.webp')){file_put_contents($dir2.'/cover.webp',$bytes);chmod($dir2.'/cover.webp',0600);}nj_import($db,['song_key'=>$key2,'source_url'=>'','suno_id'=>'','suno_title'=>'JUKEBOX MP3 업로드 검증용 합성 음악','cover_path'=>'검증/MP3 업로드 검증/cover.webp','cover_bytes'=>strlen($bytes),'cover_sha256'=>hash('sha256',$bytes),'errors'=>[]]);return ['key'=>$key,'second_key'=>$key2,'separate_from_catalog'=>true];
 }
 if($action==='upload_claim'){
  nj_schema($db);nu_housekeeping($db);$db->beginTransaction();try{
   $rows=$db->query("SELECT * FROM noa_jukebox_uploads WHERE status IN ('analyzing','processing') AND (lease_until IS NULL OR lease_until<CURRENT_TIMESTAMP()) ORDER BY sequence LIMIT 5 FOR UPDATE")->fetchAll(PDO::FETCH_ASSOC);$out=[];
   foreach($rows as $u){$lease=bin2hex(random_bytes(16));$db->prepare("UPDATE noa_jukebox_uploads SET lease=?,lease_until=CURRENT_TIMESTAMP()+INTERVAL 40 MINUTE,status='analyzing',error=NULL WHERE id=?")->execute([$lease,$u['id']]);$a=nj_find($db,$u['song_key']);$out[]=['id'=>$u['id'],'key'=>$u['song_key'],'lease'=>$lease,'sha256'=>$u['sha256'],'bytes'=>(int)$u['file_bytes'],'extension'=>$u['extension'],'source_url'=>$u['source_url'],'context'=>json_decode($u['context'],true),'previous_sha256'=>$u['previous_sha256'],'cover_path'=>$a['cover_path']??null];}
   $db->commit();return ['uploads'=>$out];
  }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
 }
 if(in_array($action,['upload_state','upload_fail','upload_commit'],true)){
  $u=nu_row($db,(string)($input['id']??''));if(!is_string($input['lease']??null)||!$u['lease']||!hash_equals($u['lease'],$input['lease'])||!in_array($u['status'],['analyzing','processing'],true))throw new DomainException('upload_lease_changed');
  if($action==='upload_fail'){$error=preg_replace('/[^a-zA-Z0-9_:-]/','_',substr((string)($input['error']??'audio_processing_failed'),0,190));$db->prepare("UPDATE noa_jukebox_uploads SET status='failed',error=?,lease=NULL,lease_until=NULL WHERE id=?")->execute([$error,$u['id']]);return ['failed'=>true];}
  if($action==='upload_state'){
   if(($input['status']??'')!=='processing')throw new InvalidArgumentException('invalid_processing_state');$before=$input['source_analysis']??[];if(($before['sha256']??'')!==$u['sha256'])throw new DomainException('source_hash_mismatch');
   $db->prepare("UPDATE noa_jukebox_uploads SET status='processing',source_analysis=? WHERE id=?")->execute([json_encode($before,JSON_THROW_ON_ERROR),$u['id']]);return ['processing'=>true];
  }
  $r=$input['result']??[];if(($r['song_key']??'')!==$u['song_key']||($r['source_url']??null)!==$u['source_url']||($r['source_analysis']['sha256']??'')!==$u['sha256'])throw new DomainException('upload_result_identity_mismatch');
  $path=nj_file((string)($r['audio_path']??''));$root=realpath(nj_private().'/media');if(!$root||!$path||!str_starts_with($path,$root.'/'))throw new DomainException('private_output_missing');
  $a=nj_find($db,$u['song_key']);$cover=nj_verified($a,'cover')?nj_file($a['cover_path']):null;
  if($cover){$target=dirname($path).'/cover.webp';if(!is_file($target)){if(!copy($cover,$target))throw new RuntimeException('cover_copy_failed');chmod($target,0600);}if(!hash_equals($a['cover_sha256'],hash_file('sha256',$target)))throw new DomainException('cover_copy_conflict');$r['cover_path']=dirname($r['audio_path']).'/cover.webp';$r['cover_bytes']=filesize($target);$r['cover_sha256']=hash_file('sha256',$target);}
  if(!nj_verified($a,'audio')||!hash_equals($a['audio_sha256'],(string)($r['audio_sha256']??'')))nj_import($db,$r,true,$u['previous_sha256']);
  $db->prepare("UPDATE noa_jukebox_uploads SET status='ready',source_analysis=?,correction=?,final_analysis=?,error=NULL,lease=NULL,lease_until=NULL WHERE id=?")->execute([json_encode($r['source_analysis'],JSON_THROW_ON_ERROR),json_encode($r['correction'],JSON_THROW_ON_ERROR),json_encode($r['final_analysis'],JSON_THROW_ON_ERROR),$u['id']]);nu_clean($u);return ['ready'=>true,'audio_sha256'=>$r['audio_sha256'],'input_removed'=>!is_file(nu_dir($u['id']).'/input.audio')];
 }
 throw new InvalidArgumentException('unknown_fixed_operation');
}
